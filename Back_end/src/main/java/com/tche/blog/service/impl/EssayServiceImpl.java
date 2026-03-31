package com.tche.blog.service.impl;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tche.blog.aop.TrackOperation;
import com.tche.blog.common.BusinessException;
import com.tche.blog.config.AmapProperties;
import com.tche.blog.dto.essay.EssayDetailResponse;
import com.tche.blog.dto.essay.EssayImageUploadResponse;
import com.tche.blog.dto.essay.EssayLocationResponse;
import com.tche.blog.dto.essay.EssaySummaryResponse;
import com.tche.blog.dto.essay.EssayUpdateRequest;
import com.tche.blog.mapper.EssayMapper;
import com.tche.blog.mapper.UserMapper;
import com.tche.blog.model.EssayEntity;
import com.tche.blog.model.StorageRecord;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.ActivityLogService;
import com.tche.blog.service.EssayService;
import com.tche.blog.service.ObjectStorageService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EssayServiceImpl implements EssayService {
  private static final Logger LOGGER = LoggerFactory.getLogger(EssayServiceImpl.class);
  private static final String ADMIN_USERNAME = "admin";
  private static final int DEFAULT_LIMIT = 5;
  private static final int MAX_LIMIT = 20;
  private static final int EXCERPT_MAX_LENGTH = 120;
  private static final int LOCATION_MAX_LENGTH = 120;
  private static final String AMAP_SUCCESS_STATUS = "1";
  private static final Pattern IMAGE_SRC_PATTERN = Pattern.compile(
    "(?is)<img\\b[^>]*?src\\s*=\\s*([\"'])(.*?)\\1"
  );

  private final EssayMapper essayMapper;
  private final UserMapper userMapper;
  private final ObjectStorageService objectStorageService;
  private final ActivityLogService activityLogService;
  private final AmapProperties amapProperties;
  private final ObjectMapper objectMapper;

  @Override
  public List<EssaySummaryResponse> listLatestAdminEssays(int limit) {
    int safeLimit = normalizeLimit(limit);
    List<EssayEntity> essays = essayMapper.selectList(
      new LambdaQueryWrapper<EssayEntity>()
        .eq(EssayEntity::getAuthorName, ADMIN_USERNAME)
        .and(wrapper -> wrapper.isNull(EssayEntity::getHidden).or().eq(EssayEntity::getHidden, false))
        .orderByDesc(EssayEntity::getUpdatedAt)
        .orderByDesc(EssayEntity::getCreatedAt)
        .last("LIMIT " + safeLimit)
    );
    return toSummaryResponses(essays);
  }

  @Override
  public List<EssaySummaryResponse> listMyAdminEssays(UserEntity user) {
    ensureAdmin(user);

    List<EssayEntity> essays = essayMapper.selectList(
      new LambdaQueryWrapper<EssayEntity>()
        .eq(EssayEntity::getAuthorName, ADMIN_USERNAME)
        .orderByDesc(EssayEntity::getUpdatedAt)
        .orderByDesc(EssayEntity::getCreatedAt)
    );
    return toSummaryResponses(essays);
  }

  @Override
  public EssayDetailResponse getEssay(Long essayId) {
    EssayEntity essay = essayMapper.selectById(essayId);
    if (essay == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "essay not found");
    }

    String content = resolveEssayContent(essay.getContentPath());
    String authorName = normalizeText(essay.getAuthorName());
    String authorNickname = resolveAuthorNickname(authorName, new HashMap<>());
    String location = normalizeLocation(essay.getLocation());
    String coverImage = normalizeText(essay.getCoverImage());
    Boolean hidden = essay.getHidden() != null && essay.getHidden();
    return toDetailResponse(essay, content, location, coverImage, authorName, authorNickname, hidden);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "essay_create", target = "essay")
  public EssayDetailResponse createEssay(EssayUpdateRequest request, UserEntity user) {
    ensureAdmin(user);

    String title = normalizeText(request.title());
    String location = normalizeLocation(request.location());
    String coverImage = normalizeText(request.coverImage());
    String content = request.content() == null ? "" : request.content();
    if (title.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "title is required");
    }
    if (!hasMeaningfulContent(content)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "content is required");
    }

    StorageRecord contentRecord = objectStorageService.saveArticleContent(title, content);

    Boolean hidden = request.hidden() != null && request.hidden();

    EssayEntity essay = new EssayEntity();
    essay.setTitle(title);
    essay.setContentPath(contentRecord.aliyunPath());
    essay.setAuthorId(user.getId());
    essay.setAuthorName(user.getUsername());
    essay.setLocation(location);
    essay.setCoverImage(coverImage);
    essay.setHidden(hidden);
    essayMapper.insert(essay);

    activityLogService.log(
      "essay_create",
      user.getId(),
      Map.of(
        "essayId",
        essay.getId(),
        "title",
        essay.getTitle(),
        "location",
        location,
        "coverImage",
        coverImage,
        "contentPath",
        contentRecord.aliyunPath()
      )
    );

    String authorName = normalizeText(user.getUsername());
    String authorNickname = normalizeText(user.getNickname());
    if (authorNickname.isBlank()) {
      authorNickname = authorName;
    }
    return toDetailResponse(essay, content, location, coverImage, authorName, authorNickname, hidden);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "essay_update", target = "essay")
  public EssayDetailResponse updateEssay(Long essayId, EssayUpdateRequest request, UserEntity user) {
    ensureAdmin(user);

    EssayEntity essay = essayMapper.selectById(essayId);
    if (essay == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "essay not found");
    }

    String title = normalizeText(request.title());
    String location = normalizeLocation(request.location());
    String coverImage = normalizeText(request.coverImage());
    String content = request.content() == null ? "" : request.content();
    if (title.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "title is required");
    }
    if (!hasMeaningfulContent(content)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "content is required");
    }

    String oldContentPath = essay.getContentPath();
    String oldCoverImage = essay.getCoverImage();

    Boolean hidden = request.hidden() != null && request.hidden();

    StorageRecord contentRecord = objectStorageService.saveArticleContent(title, content);
    essay.setTitle(title);
    essay.setContentPath(contentRecord.aliyunPath());
    essay.setLocation(location);
    essay.setCoverImage(coverImage);
    essay.setHidden(hidden);
    essay.setUpdatedAt(LocalDateTime.now());
    essayMapper.updateById(essay);

    if (oldContentPath != null && !oldContentPath.isBlank()) {
      try {
        objectStorageService.deleteObject(oldContentPath);
      } catch (Exception ex) {
        LOGGER.warn("Failed to delete old essay content: {}", oldContentPath, ex);
      }
    }

    if (oldCoverImage != null && !oldCoverImage.isBlank() && !oldCoverImage.equals(coverImage)) {
      try {
        objectStorageService.deleteObject(oldCoverImage);
      } catch (Exception ex) {
        LOGGER.warn("Failed to delete old essay cover image: {}", oldCoverImage, ex);
      }
    }

    activityLogService.log(
      "essay_update",
      user.getId(),
      Map.of(
        "essayId",
        essay.getId(),
        "title",
        essay.getTitle(),
        "location",
        location,
        "coverImage",
        coverImage,
        "contentPath",
        contentRecord.aliyunPath()
      )
    );

    String authorName = normalizeText(essay.getAuthorName());
    String authorNickname = resolveAuthorNickname(authorName, new HashMap<>());
    return toDetailResponse(essay, content, location, coverImage, authorName, authorNickname, hidden);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "essay_delete", target = "essay")
  public void deleteEssay(Long essayId, UserEntity user) {
    ensureAdmin(user);

    EssayEntity essay = essayMapper.selectById(essayId);
    if (essay == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "essay not found");
    }
    String authorName = normalizeText(essay.getAuthorName());
    if (!ADMIN_USERNAME.equalsIgnoreCase(authorName)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "only your own essays can be deleted");
    }

    String contentPath = normalizeText(essay.getContentPath());
    String coverImage = normalizeText(essay.getCoverImage());
    boolean deleteContentObject = !contentPath.isBlank() && !isEssayContentReferencedByOthers(contentPath, essayId);
    boolean deleteCoverObject = !coverImage.isBlank() && !isEssayCoverReferencedByOthers(coverImage, essayId);

    essayMapper.deleteById(essayId);

    if (deleteContentObject) {
      try {
        objectStorageService.deleteObject(contentPath);
      } catch (Exception ex) {
        LOGGER.warn("Failed to delete essay storage object: {}", contentPath, ex);
      }
    }

    if (deleteCoverObject) {
      try {
        objectStorageService.deleteObject(coverImage);
      } catch (Exception ex) {
        LOGGER.warn("Failed to delete essay cover image: {}", coverImage, ex);
      }
    }

    activityLogService.log(
      "essay_delete",
      user.getId(),
      Map.of(
        "essayId",
        essayId,
        "title",
        normalizeText(essay.getTitle()),
        "contentDeleted",
        deleteContentObject,
        "coverDeleted",
        deleteCoverObject
      )
    );
  }

  @Override
  @TrackOperation(name = "essay_image_upload", target = "essay")
  public EssayImageUploadResponse uploadEssayImage(MultipartFile file, UserEntity user) {
    ensureAdmin(user);
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "image file is required");
    }

    String contentType = normalizeText(file.getContentType()).toLowerCase(Locale.ROOT);
    if (!contentType.startsWith("image/")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "only image files are supported");
    }

    StorageRecord record;
    try {
      record = objectStorageService.saveArticleCover(file);
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "image upload failed: " + ex.getMessage());
    }

    activityLogService.log(
      "essay_image_upload",
      user.getId(),
      Map.of("objectKey", record.objectKey(), "fileName", record.fileName())
    );
    return new EssayImageUploadResponse(record.publicUrl(), record.objectKey(), record.fileName());
  }

  @Override
  @TrackOperation(name = "essay_location_reverse", target = "essay")
  public EssayLocationResponse reverseGeocode(double latitude, double longitude, UserEntity user) {
    ensureAdmin(user);
    validateCoordinates(latitude, longitude);

    if (!amapProperties.isEnabled()) {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "amap reverse geocode is disabled");
    }

    String apiKey = normalizeText(amapProperties.getKey());
    if (apiKey.isBlank()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "amap key is not configured");
    }

    String endpoint = normalizeText(amapProperties.getReverseGeocodeUrl());
    if (endpoint.isBlank()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "amap reverse geocode url is not configured");
    }

    String responseBody = requestAmapReverseGeocode(endpoint, apiKey, latitude, longitude);
    String location = parseAmapLocation(responseBody);
    if (location.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "amap reverse geocode returned empty location");
    }

    activityLogService.log(
      "essay_location_reverse",
      user.getId(),
      Map.of("latitude", latitude, "longitude", longitude, "location", location)
    );
    return new EssayLocationResponse(location, latitude, longitude);
  }

  private EssayDetailResponse toDetailResponse(
    EssayEntity essay,
    String content,
    String location,
    String coverImage,
    String authorName,
    String authorNickname,
    Boolean hidden
  ) {
    return new EssayDetailResponse(
      essay.getId(),
      normalizeText(essay.getTitle()),
      location,
      coverImage,
      content,
      authorName,
      authorNickname,
      hidden,
      essay.getCreatedAt(),
      essay.getUpdatedAt()
    );
  }

  private int normalizeLimit(int limit) {
    if (limit <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(limit, MAX_LIMIT);
  }

  private String resolveEssayContent(String contentPath) {
    String normalizedPath = normalizeText(contentPath);
    if (normalizedPath.isBlank()) {
      return "";
    }
    if (normalizedPath.startsWith("aliyun/")) {
      String loaded = objectStorageService.loadObjectText(normalizedPath);
      if (loaded != null) {
        return loaded;
      }
    }
    return normalizedPath;
  }

  private String buildExcerpt(String content) {
    String plain = stripHtml(content);
    if (plain.isBlank()) {
      return "No content";
    }
    if (plain.length() <= EXCERPT_MAX_LENGTH) {
      return plain;
    }
    return plain.substring(0, EXCERPT_MAX_LENGTH).trim() + "...";
  }

  private boolean hasMeaningfulContent(String content) {
    String normalized = normalizeText(content);
    if (normalized.isBlank()) {
      return false;
    }
    if (!stripHtml(normalized).isBlank()) {
      return true;
    }
    return normalized.toLowerCase(Locale.ROOT).contains("<img");
  }

  private List<EssaySummaryResponse> toSummaryResponses(List<EssayEntity> essays) {
    Map<String, String> nicknameCache = new HashMap<>();
    return essays
      .stream()
      .map((essay) -> {
        String content = resolveEssayContent(essay.getContentPath());
        String excerpt = buildExcerpt(content);
        String coverImage = normalizeText(essay.getCoverImage());
        if (coverImage.isBlank()) {
          coverImage = extractCoverImage(content);
        }
        String location = normalizeLocation(essay.getLocation());
        String authorName = normalizeText(essay.getAuthorName());
        String authorNickname = resolveAuthorNickname(authorName, nicknameCache);
        Boolean hidden = essay.getHidden() != null && essay.getHidden();
        return new EssaySummaryResponse(
          essay.getId(),
          normalizeText(essay.getTitle()),
          excerpt,
          coverImage,
          location,
          authorName,
          authorNickname,
          hidden,
          essay.getCreatedAt(),
          resolvePublishedAt(essay)
        );
      })
      .toList();
  }

  private LocalDateTime resolvePublishedAt(EssayEntity essay) {
    if (essay == null) {
      return null;
    }
    return essay.getUpdatedAt() != null ? essay.getUpdatedAt() : essay.getCreatedAt();
  }

  private String stripHtml(String value) {
    String text = normalizeText(value);
    if (text.isBlank()) {
      return "";
    }
    return text
      .replaceAll("(?i)<br\\s*/?>", "\n")
      .replaceAll("(?i)</p>", "\n")
      .replaceAll("<[^>]+>", " ")
      .replace("&nbsp;", " ")
      .replaceAll("\\s+", " ")
      .trim();
  }

  private String resolveAuthorNickname(String authorName, Map<String, String> nicknameCache) {
    String normalizedAuthor = normalizeText(authorName);
    if (normalizedAuthor.isBlank()) {
      return "";
    }

    String cacheKey = normalizedAuthor.toLowerCase(Locale.ROOT);
    if (nicknameCache.containsKey(cacheKey)) {
      return nicknameCache.get(cacheKey);
    }

    String nickname = userMapper
      .selectByUsername(normalizedAuthor)
      .map(UserEntity::getNickname)
      .map(this::normalizeText)
      .filter(value -> !value.isBlank())
      .orElse(normalizedAuthor);

    nicknameCache.put(cacheKey, nickname);
    return nickname;
  }

  private boolean isEssayContentReferencedByOthers(String contentPath, Long deletingEssayId) {
    if (contentPath == null || contentPath.isBlank()) {
      return false;
    }
    Long count = essayMapper.selectCount(
      new LambdaQueryWrapper<EssayEntity>()
        .eq(EssayEntity::getContentPath, contentPath)
        .ne(EssayEntity::getId, deletingEssayId)
    );
    return count != null && count > 0;
  }

  private boolean isEssayCoverReferencedByOthers(String coverImage, Long deletingEssayId) {
    if (coverImage == null || coverImage.isBlank()) {
      return false;
    }
    Long count = essayMapper.selectCount(
      new LambdaQueryWrapper<EssayEntity>()
        .eq(EssayEntity::getCoverImage, coverImage)
        .ne(EssayEntity::getId, deletingEssayId)
    );
    return count != null && count > 0;
  }

  private void ensureAdmin(UserEntity user) {
    String username = user == null ? "" : normalizeText(user.getUsername());
    if (!ADMIN_USERNAME.equalsIgnoreCase(username)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "only admin can operate essays");
    }
  }

  private String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeLocation(String value) {
    String normalized = normalizeText(value);
    if (normalized.isBlank()) {
      return "";
    }
    if (normalized.length() <= LOCATION_MAX_LENGTH) {
      return normalized;
    }
    return normalized.substring(0, LOCATION_MAX_LENGTH).trim();
  }

  private String extractCoverImage(String content) {
    String html = normalizeText(content);
    if (html.isBlank()) {
      return "";
    }
    Matcher matcher = IMAGE_SRC_PATTERN.matcher(html);
    if (!matcher.find()) {
      return "";
    }
    return normalizeText(matcher.group(2));
  }

  private String requestAmapReverseGeocode(String endpoint, String key, double latitude, double longitude) {
    int connectTimeout = Math.max(1, amapProperties.getConnectTimeoutSeconds());
    int readTimeout = Math.max(1, amapProperties.getReadTimeoutSeconds());
    String locationParam = longitude + "," + latitude;
    String requestUrl =
      endpoint +
      "?key=" +
      key +
      "&location=" +
      locationParam +
      "&extensions=base&batch=false&roadlevel=0";

    HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(connectTimeout)).build();
    HttpRequest request = HttpRequest
      .newBuilder(URI.create(requestUrl))
      .timeout(Duration.ofSeconds(readTimeout))
      .header("Accept", "application/json")
      .GET()
      .build();

    try {
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() >= 400) {
        throw new BusinessException(
          HttpStatus.BAD_GATEWAY,
          "amap reverse geocode failed with HTTP " + response.statusCode()
        );
      }
      return response.body();
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "amap reverse geocode request failed");
    }
  }

  private String parseAmapLocation(String responseBody) {
    try {
      JsonNode root = objectMapper.readTree(responseBody);
      String status = normalizeText(root.path("status").asText(""));
      if (!AMAP_SUCCESS_STATUS.equals(status)) {
        String info = normalizeText(root.path("info").asText(""));
        String message = info.isBlank() ? "amap reverse geocode failed" : "amap reverse geocode failed: " + info;
        throw new BusinessException(HttpStatus.BAD_GATEWAY, message);
      }

      JsonNode regeocode = root.path("regeocode");
      String formattedAddress = normalizeText(regeocode.path("formatted_address").asText(""));
      JsonNode addressComponent = regeocode.path("addressComponent");
      String province = asTextOrArray(addressComponent.path("province"));
      String city = asTextOrArray(addressComponent.path("city"));
      String district = asTextOrArray(addressComponent.path("district"));
      String township = asTextOrArray(addressComponent.path("township"));
      return buildLocationLabel(province, city, district, township, formattedAddress);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "amap reverse geocode response parse failed");
    }
  }

  private String asTextOrArray(JsonNode node) {
    if (node == null || node.isMissingNode() || node.isNull()) {
      return "";
    }
    if (node.isTextual() || node.isNumber()) {
      return normalizeText(node.asText(""));
    }
    if (node.isArray()) {
      for (JsonNode item : node) {
        String text = asTextOrArray(item);
        if (!text.isBlank()) {
          return text;
        }
      }
      return "";
    }
    return normalizeText(node.asText(""));
  }

  private String buildLocationLabel(
    String province,
    String city,
    String district,
    String township,
    String formattedAddress
  ) {
    List<String> parts = new ArrayList<>();
    appendLocationPart(parts, province);
    appendLocationPart(parts, city);
    appendLocationPart(parts, district);
    if (parts.size() < 2) {
      appendLocationPart(parts, township);
    }

    if (!parts.isEmpty()) {
      return normalizeLocation(String.join("·", parts));
    }

    return normalizeLocation(formattedAddress);
  }

  private void appendLocationPart(List<String> parts, String value) {
    String normalized = normalizeText(value);
    if (normalized.isBlank()) {
      return;
    }

    for (String existing : parts) {
      if (existing.equalsIgnoreCase(normalized)) {
        return;
      }
    }
    parts.add(normalized);
  }

  @Override
  public EssaySummaryResponse getNextLatestEssayExcluding(Long currentEssayId) {
    if (currentEssayId == null || currentEssayId <= 0) {
      return null;
    }
    List<EssayEntity> essays = essayMapper.selectList(
      new LambdaQueryWrapper<EssayEntity>()
        .eq(EssayEntity::getAuthorName, ADMIN_USERNAME)
        .ne(EssayEntity::getId, currentEssayId)
        .eq(EssayEntity::getHidden, 0)
        .orderByDesc(EssayEntity::getUpdatedAt)
        .orderByDesc(EssayEntity::getCreatedAt)
        .last("LIMIT 1")
    );
    System.out.println(essays);
    if (essays.isEmpty()) {
      return null;
    }
    return toSummaryResponses(essays).get(0);
  }

  private void validateCoordinates(double latitude, double longitude) {
    if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "latitude is out of range");
    }
    if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "longitude is out of range");
    }
  }
}
