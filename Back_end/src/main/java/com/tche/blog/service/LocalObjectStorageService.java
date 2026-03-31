package com.tche.blog.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.model.OSSObject;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tche.blog.common.BusinessException;
import com.tche.blog.config.AliyunOssProperties;
import com.tche.blog.config.StorageProperties;
import com.tche.blog.mapper.StorageRecordMapper;
import com.tche.blog.model.ObjectType;
import com.tche.blog.model.StorageRecord;
import com.tche.blog.model.StorageRecordEntity;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocalObjectStorageService implements ObjectStorageService {
  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

  private final AliyunOssProperties aliyunOssProperties;
  private final StorageProperties storageProperties;
  private final StorageRecordMapper storageRecordMapper;
  private final ObjectMapper objectMapper;

  @PostConstruct
  public void init() {
    if (!aliyunOssProperties.isEnabled()) {
      initFolders();
    }
  }

  @Override
  public StorageRecord saveAvatar(MultipartFile file) throws IOException {
    String ext = getFileExtension(file.getOriginalFilename());
    byte[] bytes = file.getBytes();
    return save(ObjectType.AVATAR, bytes, ext, null);
  }

  @Override
  public StorageRecord saveArticleCover(MultipartFile file) throws IOException {
    String ext = getFileExtension(file.getOriginalFilename());
    byte[] bytes = file.getBytes();
    return save(ObjectType.ARTICLE, bytes, ext, null);
  }

  @Override
  public StorageRecord saveArticleImage(MultipartFile file) throws IOException {
    String ext = getFileExtension(file.getOriginalFilename());
    byte[] bytes = file.getBytes();
    return save(ObjectType.ARTICLE_IMAGE, bytes, ext, null);
  }

  @Override
  public StorageRecord saveLog(Map<String, Object> payload) {
    byte[] bytes;
    String payloadJson;
    try {
      payloadJson = objectMapper.writeValueAsString(payload);
      bytes = objectMapper.writeValueAsBytes(payload);
    } catch (JsonProcessingException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to build log payload");
    }
    return save(ObjectType.LOG, bytes, "json", payloadJson);
  }

  @Override
  public StorageRecord saveLogDirectly(byte[] content, String aliyunPath) {
    String objectKey = toObjectKey(aliyunPath);
    if (aliyunOssProperties.isEnabled()) {
      uploadToAliyun(objectKey, content);
      String publicUrl = aliyunPublicUrl(objectKey);
      return new StorageRecord(ObjectType.LOG, objectKey, aliyunPath, getFileNameFromPath(objectKey), LocalDate.now().format(DATE_FORMATTER), 0, publicUrl, LocalDateTime.now());
    } else {
      Path dir = root().resolve(aliyunOssProperties.getLogDir());
      try {
        Files.createDirectories(dir);
        Path filePath = dir.resolve(getFileNameFromPath(objectKey));
        Files.write(filePath, content);
        String publicUrl = publicUrl(aliyunOssProperties.getLogDir(), getFileNameFromPath(objectKey));
        return new StorageRecord(ObjectType.LOG, objectKey, aliyunPath, getFileNameFromPath(objectKey), LocalDate.now().format(DATE_FORMATTER), 0, publicUrl, LocalDateTime.now());
      } catch (IOException e) {
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to save log directly: " + e.getMessage());
      }
    }
  }

  private String getFileNameFromPath(String path) {
    if (path == null || path.isBlank()) {
      return "";
    }
    int lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
  }

  @Override
  public StorageRecord saveArticleContent(String title, String content) {
    String safeContent = content == null ? "" : content;
    Map<String, Object> meta = Map.of(
      "title",
      title == null ? "" : title,
      "length",
      safeContent.length()
    );
    String payloadJson;
    try {
      payloadJson = objectMapper.writeValueAsString(meta);
    } catch (JsonProcessingException e) {
      payloadJson = null;
    }
    return save(ObjectType.ARTICLE, safeContent.getBytes(StandardCharsets.UTF_8), "md", payloadJson);
  }

  @Override
  public String loadObjectText(String aliyunPath) {
    if (aliyunPath == null || aliyunPath.isBlank()) {
      return "";
    }

    String objectKey = toObjectKey(aliyunPath);
    if (aliyunOssProperties.isEnabled()) {
      return loadFromAliyun(objectKey);
    }

    Path path = root().resolve(objectKey).normalize();
    if (!path.startsWith(root().normalize())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "invalid object path");
    }
    if (!Files.exists(path) || Files.isDirectory(path)) {
      return "";
    }
    try {
      return Files.readString(path, StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to load object text");
    }
  }

  @Override
  public void deleteObject(String aliyunPathOrPublicUrl) {
    String normalizedInput = trim(aliyunPathOrPublicUrl);
    if (normalizedInput == null) {
      return;
    }

    String resolvedAliyunPath = resolveAliyunPathForDelete(normalizedInput);
    if (resolvedAliyunPath == null || resolvedAliyunPath.isBlank()) {
      return;
    }

    String objectKey = toObjectKey(resolvedAliyunPath);
    if (objectKey.isBlank()) {
      return;
    }

    if (aliyunOssProperties.isEnabled()) {
      deleteFromAliyun(objectKey);
      return;
    }

    deleteFromLocal(objectKey);
  }

  @Override
  public Path resolvePath(String folder, String fileName) {
    Path resolved = root().resolve(folder).resolve(fileName).normalize();
    Path expectedPrefix = root().resolve(folder).normalize();
    if (!resolved.startsWith(expectedPrefix)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "invalid file path");
    }
    return resolved;
  }

  private synchronized StorageRecord save(ObjectType type, byte[] content, String ext, String payloadJson) {
    try {
      String dateKey = LocalDate.now().format(DATE_FORMATTER);
      String folder = folderFor(type);
      int index = nextIndex(type, dateKey);
      String fileName = buildFileName(dateKey, type.getLabel(), index, ext);
      String objectKey = folder + "/" + fileName;
      if (aliyunOssProperties.isEnabled()) {
        uploadToAliyun(objectKey, content);
      } else {
        Path dir = root().resolve(folder);
        Files.createDirectories(dir);
        Path filePath = dir.resolve(fileName);
        Files.write(filePath, content);
      }

      String aliyunPath = "aliyun/" + objectKey;
      String publicUrl = aliyunOssProperties.isEnabled() ? aliyunPublicUrl(objectKey) : publicUrl(folder, fileName);

      StorageRecordEntity record = new StorageRecordEntity();
      record.setRecordType(type.getFolder());
      record.setObjectKey(objectKey);
      record.setAliyunPath(aliyunPath);
      record.setFileName(fileName);
      record.setDateKey(dateKey);
      record.setFileIndex(index);
      record.setPublicUrl(publicUrl);
      record.setPayloadJson(payloadJson);

      log.info("Saving storage record: type={}, objectKey={}, fileName={}", type, objectKey, fileName);
      storageRecordMapper.insert(record);
      log.info("Storage record saved successfully: id={}", record.getId());

      LocalDateTime createdAt = record.getCreatedAt() != null ? record.getCreatedAt() : LocalDateTime.now();
      return new StorageRecord(type, objectKey, aliyunPath, fileName, dateKey, index, publicUrl, createdAt);
    } catch (Exception e) {
      log.error("Failed to save object: type={}, ext={}, error={}", type, ext, e.getMessage(), e);
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to save object: " + e.getMessage());
    }
  }

  private int nextIndex(ObjectType type, String dateKey) {
    String recordType = type.getFolder();
    StorageRecordEntity latest = storageRecordMapper.selectOne(
      new LambdaQueryWrapper<StorageRecordEntity>()
        .eq(StorageRecordEntity::getRecordType, recordType)
        .eq(StorageRecordEntity::getDateKey, dateKey)
        .orderByDesc(StorageRecordEntity::getFileIndex)
        .last("LIMIT 1")
    );
    return latest == null || latest.getFileIndex() == null ? 0 : latest.getFileIndex() + 1;
  }

  private void initFolders() {
    try {
      Files.createDirectories(root().resolve(aliyunOssProperties.getAvatarDir()));
      Files.createDirectories(root().resolve(aliyunOssProperties.getLogDir()));
      Files.createDirectories(root().resolve(aliyunOssProperties.getArticleDir()));
    } catch (IOException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to initialize storage folders");
    }
  }

  private Path root() {
    String configured = storageProperties.getLocalRoot();
    if (configured == null || configured.isBlank()) {
      return Paths.get("aliyun");
    }
    return Paths.get(configured);
  }

  private String folderFor(ObjectType type) {
    if (type == ObjectType.AVATAR) {
      return aliyunOssProperties.getAvatarDir();
    }
    if (type == ObjectType.LOG) {
      return aliyunOssProperties.getLogDir();
    }
    return aliyunOssProperties.getArticleDir();
  }

  private String buildFileName(String dateKey, String label, int index, String ext) {
    String normalized = normalizeExt(ext);
    return dateKey + "-" + label + "-" + index + normalized;
  }

  private String normalizeExt(String ext) {
    if (ext == null || ext.isBlank()) {
      return "";
    }
    return ext.startsWith(".") ? ext : "." + ext;
  }

  private String getFileExtension(String fileName) {
    if (fileName == null || fileName.isBlank() || !fileName.contains(".")) {
      return "";
    }
    return fileName.substring(fileName.lastIndexOf('.') + 1);
  }

  private String publicUrl(String folder, String fileName) {
    String base = storageProperties.getPublicBaseUrl();
    String normalized = (base == null || base.isBlank()) ? "/api/files" : base;
    if (normalized.endsWith("/")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    return normalized + "/" + folder + "/" + UriUtils.encode(fileName, StandardCharsets.UTF_8);
  }

  private void uploadToAliyun(String objectKey, byte[] content) {
    OSS client = buildAliyunClient();
    try {
      client.putObject(aliyunOssProperties.getBucketName(), objectKey, new ByteArrayInputStream(content));
    } catch (OSSException | ClientException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to upload object to aliyun");
    } finally {
      client.shutdown();
    }
  }

  private void deleteFromAliyun(String objectKey) {
    OSS client = buildAliyunClient();
    try {
      client.deleteObject(aliyunOssProperties.getBucketName(), objectKey);
    } catch (OSSException e) {
      if ("NoSuchKey".equalsIgnoreCase(e.getErrorCode())) {
        return;
      }
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to delete object from aliyun");
    } catch (ClientException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to delete object from aliyun");
    } finally {
      client.shutdown();
    }
  }

  private void deleteFromLocal(String objectKey) {
    Path rootPath = root().normalize();
    Path path = rootPath.resolve(objectKey).normalize();
    if (!path.startsWith(rootPath)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "invalid object path");
    }
    try {
      Files.deleteIfExists(path);
    } catch (IOException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to delete local object");
    }
  }

  private String resolveAliyunPathForDelete(String input) {
    if (input.startsWith("aliyun/")) {
      return input;
    }

    StorageRecordEntity byAliyunPath = findStorageRecord(
      new LambdaQueryWrapper<StorageRecordEntity>()
        .select(StorageRecordEntity::getAliyunPath)
        .eq(StorageRecordEntity::getAliyunPath, input)
    );
    if (byAliyunPath != null && byAliyunPath.getAliyunPath() != null && !byAliyunPath.getAliyunPath().isBlank()) {
      return byAliyunPath.getAliyunPath();
    }

    StorageRecordEntity byPublicUrl = findStorageRecord(
      new LambdaQueryWrapper<StorageRecordEntity>()
        .select(StorageRecordEntity::getAliyunPath)
        .eq(StorageRecordEntity::getPublicUrl, input)
    );
    if (byPublicUrl != null && byPublicUrl.getAliyunPath() != null && !byPublicUrl.getAliyunPath().isBlank()) {
      return byPublicUrl.getAliyunPath();
    }

    if (input.startsWith("http://") || input.startsWith("https://")) {
      try {
        URI uri = URI.create(input);
        String host = trim(uri.getHost());
        String path = trim(uri.getPath());
        if (host != null && host.contains("aliyuncs.com") && path != null) {
          String objectKey = path.startsWith("/") ? path.substring(1) : path;
          if (!objectKey.isBlank()) {
            return "aliyun/" + objectKey;
          }
        }
      } catch (IllegalArgumentException ignored) {
        return null;
      }
      return null;
    }

    if (!input.startsWith("/") && input.contains("/")) {
      return "aliyun/" + input;
    }
    return null;
  }

  private StorageRecordEntity findStorageRecord(LambdaQueryWrapper<StorageRecordEntity> queryWrapper) {
    List<StorageRecordEntity> records = storageRecordMapper.selectList(queryWrapper.last("LIMIT 1"));
    return records.isEmpty() ? null : records.get(0);
  }

  private String loadFromAliyun(String objectKey) {
    OSS client = buildAliyunClient();
    try {
      OSSObject object = client.getObject(aliyunOssProperties.getBucketName(), objectKey);
      if (object == null) {
        return "";
      }
      try (InputStream stream = object.getObjectContent()) {
        return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
    } catch (OSSException e) {
      if ("NoSuchKey".equalsIgnoreCase(e.getErrorCode())) {
        return "";
      }
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to load object from aliyun");
    } catch (ClientException | IOException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to load object from aliyun");
    } finally {
      client.shutdown();
    }
  }

  private OSS buildAliyunClient() {
    if (!aliyunOssProperties.isEnabled()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "aliyun oss is disabled");
    }
    String endpoint = trim(aliyunOssProperties.getEndpoint());
    String accessKeyId = trim(aliyunOssProperties.getAccessKeyId());
    String accessKeySecret = trim(aliyunOssProperties.getAccessKeySecret());
    String bucketName = trim(aliyunOssProperties.getBucketName());
    if (endpoint == null || accessKeyId == null || accessKeySecret == null || bucketName == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "aliyun oss config is incomplete");
    }
    return new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
  }

  private String aliyunPublicUrl(String objectKey) {
    String endpoint = trim(aliyunOssProperties.getEndpoint());
    String bucketName = trim(aliyunOssProperties.getBucketName());
    if (endpoint == null || bucketName == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "aliyun oss config is incomplete");
    }

    String protocol = endpoint.startsWith("http://") ? "http://" : "https://";
    String host = endpoint.replaceFirst("^https?://", "");
    host = host.endsWith("/") ? host.substring(0, host.length() - 1) : host;
    String encodedKey =
      URLEncoder
        .encode(objectKey, StandardCharsets.UTF_8)
        .replace("+", "%20")
        .replace("%2F", "/");
    return protocol + bucketName + "." + host + "/" + encodedKey;
  }

  private String trim(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private String toObjectKey(String aliyunPath) {
    String value = aliyunPath.trim();
    return value.startsWith("aliyun/") ? value.substring("aliyun/".length()) : value;
  }
}
