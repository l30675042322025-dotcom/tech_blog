package com.tche.blog.service.impl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.tche.blog.aop.TrackOperation;
import com.tche.blog.common.BusinessException;
import com.tche.blog.dto.article.ArticleBatchCategoryUpdateRequest;
import com.tche.blog.dto.article.ArticleBatchDeleteRequest;
import com.tche.blog.dto.article.ArticleBatchOperationResponse;
import com.tche.blog.dto.article.ArticleCoverUploadResponse;
import com.tche.blog.dto.article.ArticleDetailResponse;
import com.tche.blog.dto.article.ArticleImageUploadResponse;
import com.tche.blog.dto.article.FavoriteResponse;
import com.tche.blog.dto.article.ArticlePreviewResponse;
import com.tche.blog.dto.article.ArticleSummaryResponse;
import com.tche.blog.dto.article.ArticleUpdateRequest;
import com.tche.blog.dto.article.CommentCreateRequest;
import com.tche.blog.dto.article.CommentResponse;
import com.tche.blog.dto.article.LikeResponse;
import com.tche.blog.mapper.ArticleFavoriteMapper;
import com.tche.blog.mapper.ArticleLikeMapper;
import com.tche.blog.mapper.ArticleMapper;
import com.tche.blog.mapper.ArticleTagMapper;
import com.tche.blog.mapper.CommentMapper;
import com.tche.blog.mapper.UserMapper;
import com.tche.blog.model.ArticleFavoriteEntity;
import com.tche.blog.model.ArticleEntity;
import com.tche.blog.model.ArticleLikeEntity;
import com.tche.blog.model.ArticleTagEntity;
import com.tche.blog.model.CommentEntity;
import com.tche.blog.model.StorageRecord;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.ActivityLogService;
import com.tche.blog.service.AiSummaryService;
import com.tche.blog.service.ArticleService;
import com.tche.blog.service.CategoryService;
import com.tche.blog.service.ObjectStorageService;
import com.tche.blog.service.ViewMapper;

import lombok.RequiredArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ArticleServiceImpl implements ArticleService {
  private static final Logger LOGGER = LoggerFactory.getLogger(ArticleServiceImpl.class);
  private static final String ADMIN_USERNAME = "admin";
  private static final String STATUS_DRAFT = "draft";
  private static final String STATUS_PUBLISHED = "published";
  private static final String STATUS_SCHEDULED = "scheduled";

  private final ArticleMapper articleMapper;
  private final ArticleTagMapper articleTagMapper;
  private final ArticleLikeMapper articleLikeMapper;
  private final ArticleFavoriteMapper articleFavoriteMapper;
  private final CommentMapper commentMapper;
  private final UserMapper userMapper;
  private final ObjectStorageService objectStorageService;
  private final ActivityLogService activityLogService;
  private final CategoryService categoryService;
  private final AiSummaryService aiSummaryService;

  @Override
  public List<ArticleSummaryResponse> listArticles() {
    return listArticles(null, null, null, null, null, null);
  }

  @Override
  public List<ArticleSummaryResponse> listArticles(String authorName) {
    return listArticles(authorName, null, null, null, null, null);
  }

  @Override
  public List<ArticleSummaryResponse> listArticles(
    String authorName,
    String category,
    String keyword,
    String sort,
    String status
  ) {
    return listArticles(authorName, category, keyword, sort, status, null);
  }

  @Override
  public List<ArticleSummaryResponse> listArticles(
    String authorName,
    String category,
    String keyword,
    String sort,
    String status,
    UserEntity viewer
  ) {
    LambdaQueryWrapper<ArticleEntity> queryWrapper = new LambdaQueryWrapper<>();

    String normalizedAuthorName = normalizeValue(authorName);
    if (!normalizedAuthorName.isBlank()) {
      queryWrapper.eq(ArticleEntity::getAuthorName, normalizedAuthorName);
    }

    String normalizedCategory = normalizeCategoryFilter(category);
    if (!normalizedCategory.isBlank()) {
      queryWrapper.eq(ArticleEntity::getCategory, normalizedCategory);
    }

    String normalizedStatus = normalizeStatusFilter(status, viewer);
    if (!normalizedStatus.isBlank()) {
      queryWrapper.eq(ArticleEntity::getStatus, normalizedStatus);
    } else {
      queryWrapper.and(wrapper ->
        wrapper
          .eq(ArticleEntity::getStatus, STATUS_PUBLISHED)
          .or()
          .eq(ArticleEntity::getStatus, STATUS_SCHEDULED)
      );
    }

    String normalizedKeyword = normalizeValue(keyword);
    if (!normalizedKeyword.isBlank()) {
      queryWrapper.and(wrapper ->
        wrapper
          .like(ArticleEntity::getTitle, normalizedKeyword)
          .or()
          .like(ArticleEntity::getSummary, normalizedKeyword)
          .or()
          .like(ArticleEntity::getAuthorName, normalizedKeyword)
          .or()
          .like(ArticleEntity::getCategory, normalizedKeyword)
      );
    }

    applySort(queryWrapper, sort);

    List<ArticleEntity> articles = articleMapper.selectList(queryWrapper);
    Map<String, String> authorAvatarMap = resolveAuthorAvatarMap(articles);
    List<ArticleSummaryResponse> responses = new ArrayList<>();
    for (ArticleEntity article : articles) {
      article.setTags(articleTagMapper.selectTagNamesByArticleId(article.getId()));
      String authorAvatarUrl = authorAvatarMap.get(normalizeAuthorKey(article.getAuthorName()));
      responses.add(ViewMapper.articleSummary(article, authorAvatarUrl));
    }
    return responses;
  }

  @Override
  public ArticleDetailResponse getArticle(Long articleId) {
    return getArticle(articleId, null);
  }

  @Override
  public ArticleDetailResponse getArticle(Long articleId, UserEntity viewer) {
    ArticleEntity article = requireVisibleArticle(articleId, viewer);

    if (!isDraftStatus(article.getStatus())) {
      articleMapper.update(
        null,
        new LambdaUpdateWrapper<ArticleEntity>()
          .eq(ArticleEntity::getId, articleId)
          .setSql("views = views + 1")
      );
      article.setViews(article.getViews() + 1);
    }
    article.setTags(articleTagMapper.selectTagNamesByArticleId(articleId));
    article.setContent(resolveArticleContent(article.getContent()));

    List<CommentEntity> comments = commentMapper.selectByArticleId(articleId);
    boolean liked = viewer != null && isArticleLikedByUser(articleId, viewer.getId());
    boolean favorited = viewer != null && isArticleFavoritedByUser(articleId, viewer.getId());
    int favorites = countArticleFavorites(articleId);
    return ViewMapper.articleDetail(article, comments, liked, favorited, favorites);
  }

  @Override
  public List<CommentResponse> listComments(Long articleId) {
    return listComments(articleId, null);
  }

  @Override
  public List<CommentResponse> listComments(Long articleId, UserEntity viewer) {
    requireVisibleArticle(articleId, viewer);
    return commentMapper.selectByArticleId(articleId).stream().map(ViewMapper::comment).toList();
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_like", target = "article")
  public LikeResponse likeArticle(Long articleId, UserEntity user) {
    requireVisibleArticle(articleId, user);

    boolean liked;
    if (isArticleLikedByUser(articleId, user.getId())) {
      int removed = articleLikeMapper.delete(
        new LambdaQueryWrapper<ArticleLikeEntity>()
          .eq(ArticleLikeEntity::getArticleId, articleId)
          .eq(ArticleLikeEntity::getUserId, user.getId())
      );
      if (removed > 0) {
        articleMapper.update(
          null,
          new LambdaUpdateWrapper<ArticleEntity>()
            .eq(ArticleEntity::getId, articleId)
            .setSql("likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END")
        );
      }
      liked = removed == 0 && isArticleLikedByUser(articleId, user.getId());
    } else {
      ArticleLikeEntity relation = new ArticleLikeEntity();
      relation.setArticleId(articleId);
      relation.setUserId(user.getId());
      try {
        articleLikeMapper.insert(relation);
        articleMapper.update(
          null,
          new LambdaUpdateWrapper<ArticleEntity>()
            .eq(ArticleEntity::getId, articleId)
            .setSql("likes = likes + 1")
        );
        liked = true;
      } catch (DuplicateKeyException ex) {
        liked = true;
      }
    }

    ArticleEntity latest = articleMapper.selectById(articleId);
    int likes = latest == null ? 0 : latest.getLikes();
    activityLogService.log("article_like", user.getId(), Map.of("articleId", articleId, "likes", likes, "liked", liked));
    return new LikeResponse(articleId, likes, liked);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_favorite", target = "article")
  public FavoriteResponse favoriteArticle(Long articleId, UserEntity user) {
    requireVisibleArticle(articleId, user);

    boolean favorited;
    if (isArticleFavoritedByUser(articleId, user.getId())) {
      int removed = articleFavoriteMapper.delete(
        new LambdaQueryWrapper<ArticleFavoriteEntity>()
          .eq(ArticleFavoriteEntity::getArticleId, articleId)
          .eq(ArticleFavoriteEntity::getUserId, user.getId())
      );
      favorited = removed == 0 && isArticleFavoritedByUser(articleId, user.getId());
    } else {
      ArticleFavoriteEntity relation = new ArticleFavoriteEntity();
      relation.setArticleId(articleId);
      relation.setUserId(user.getId());
      try {
        articleFavoriteMapper.insert(relation);
        favorited = true;
      } catch (DuplicateKeyException ex) {
        favorited = true;
      }
    }

    int favorites = countArticleFavorites(articleId);
    activityLogService.log(
      "article_favorite",
      user.getId(),
      Map.of("articleId", articleId, "favorites", favorites, "favorited", favorited)
    );
    return new FavoriteResponse(articleId, favorites, favorited);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "comment_submit", target = "comment")
  public CommentResponse addComment(Long articleId, CommentCreateRequest request, UserEntity user) {
    requireVisibleArticle(articleId, user);

    CommentEntity comment = new CommentEntity();
    comment.setArticleId(articleId);
    comment.setUserId(user.getId());
    comment.setUserName(user.getUsername());
    comment.setUserAvatarUrl(user.getAvatarUrl());
    comment.setContent(request.content().trim());
    comment.setLikes(0);
    comment.setCreatedAt(LocalDateTime.now());
    commentMapper.insert(comment);

    activityLogService.log(
      "comment_submit",
      user.getId(),
      Map.of("articleId", articleId, "commentId", comment.getId())
    );
    return ViewMapper.comment(comment);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_cover_upload", target = "article")
  public ArticleCoverUploadResponse uploadCover(UserEntity user, MultipartFile file) {
    ensureAdmin(user);
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "cover file is required");
    }

    String contentType = file.getContentType();
    if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "cover file must be an image");
    }

    StorageRecord record;
    try {
      record = objectStorageService.saveArticleCover(file);
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "cover upload failed: " + ex.getMessage());
    }

    activityLogService.log(
      "article_cover_upload",
      user.getId(),
      Map.of("objectKey", record.objectKey(), "fileName", record.fileName())
    );
    return new ArticleCoverUploadResponse(record.publicUrl(), record.objectKey(), record.fileName());
  }

  @Override
  public ArticleImageUploadResponse uploadArticleImage(UserEntity user, MultipartFile file) {
    ensureAdmin(user);
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "image file is required");
    }

    String contentType = file.getContentType();
    if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "file must be an image");
    }

    StorageRecord record;
    try {
      record = objectStorageService.saveArticleImage(file);
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "image upload failed: " + ex.getMessage());
    }

    activityLogService.log(
      "article_image_upload",
      user.getId(),
      Map.of("objectKey", record.objectKey(), "fileName", record.fileName())
    );
    return new ArticleImageUploadResponse(record.publicUrl(), record.objectKey(), record.fileName());
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_create", target = "article")
  public ArticleDetailResponse createArticle(ArticleUpdateRequest request, UserEntity user) {
    ensureAdmin(user);

    String title = normalizeValue(request.title());
    if (title.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "title is required");
    }

    String rawContent = request.content() == null ? "" : request.content();
    StorageRecord contentRecord = objectStorageService.saveArticleContent(title, rawContent);
    ResolvedSummary resolvedSummary = resolveSummary(title, request.summary(), rawContent);

    String categoryName = normalizeCategoryName(request.category());
    categoryService.ensureCategoryExists(categoryName);

    LocalDateTime now = LocalDateTime.now();
    LocalDateTime publishTime = request.publishTime();
    String finalStatus = normalizePersistStatus(request.status(), publishTime);

    ArticleEntity article = new ArticleEntity();
    article.setTitle(title);
    article.setSummary(resolvedSummary.summary());
    article.setSummaryAiGenerated(resolvedSummary.aiGenerated());
    article.setContent(contentRecord.aliyunPath());
    article.setCategory(categoryName);
    article.setStatus(finalStatus);
    article.setCoverImage(request.coverImage() == null ? "" : request.coverImage().trim());
    article.setAuthorId(user.getId());
    article.setAuthorName(user.getUsername());
    article.setViews(0);
    article.setLikes(0);
    article.setCreatedAt(now);
    article.setUpdatedAt(now);
    article.setPublishTime(publishTime != null && STATUS_SCHEDULED.equals(finalStatus) ? publishTime : null);
    articleMapper.insert(article);

    replaceTags(article.getId(), request.tags());
    article.setTags(articleTagMapper.selectTagNamesByArticleId(article.getId()));
    article.setContent(rawContent);

    activityLogService.log(
      "article_create",
      user.getId(),
      Map.of(
        "articleId",
        article.getId(),
        "title",
        article.getTitle(),
        "contentPath",
        contentRecord.aliyunPath(),
        "summaryAiGenerated",
        article.isSummaryAiGenerated(),
        "publishTime",
        publishTime != null ? publishTime.toString() : "immediate"
      )
    );
    return ViewMapper.articleDetail(article, List.of());
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_update", target = "article")
  public ArticleDetailResponse updateArticle(Long articleId, ArticleUpdateRequest request, UserEntity user) {
    ensureAdmin(user);

    ArticleEntity article = articleMapper.selectById(articleId);
    if (article == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "article not found");
    }

    String oldContentPath = article.getContent();
    String oldCoverImage = article.getCoverImage();

    if (request.title() != null && !request.title().isBlank()) {
      article.setTitle(request.title().trim());
    }
    String contentForSummary = request.content() != null ? request.content() : resolveArticleContent(article.getContent());
    ResolvedSummary resolvedSummary = null;
    if (request.summary() != null) {
      resolvedSummary = resolveSummary(article.getTitle(), request.summary(), contentForSummary);
      article.setSummary(resolvedSummary.summary());
      article.setSummaryAiGenerated(resolvedSummary.aiGenerated());
    }
    if (request.content() != null) {
      String contentTitle = request.title() == null || request.title().isBlank() ? article.getTitle() : request.title().trim();
      StorageRecord contentRecord = objectStorageService.saveArticleContent(contentTitle, request.content());
      article.setContent(contentRecord.aliyunPath());
    }
    if (request.category() != null && !request.category().isBlank()) {
      String categoryName = normalizeCategoryName(request.category());
      categoryService.ensureCategoryExists(categoryName);
      article.setCategory(categoryName);
    }
    if (request.status() != null && !request.status().isBlank()) {
      article.setStatus(normalizePersistStatus(request.status(), request.publishTime()));
    }
    if (request.publishTime() != null) {
      LocalDateTime publishTime = request.publishTime();
      if (STATUS_PUBLISHED.equals(normalizePersistStatus(request.status(), publishTime))) {
        article.setPublishTime(publishTime.isAfter(LocalDateTime.now()) ? publishTime : null);
      } else {
        article.setPublishTime(publishTime);
      }
    }
    if (request.coverImage() != null && !request.coverImage().isBlank()) {
      article.setCoverImage(request.coverImage().trim());
    }
    article.setUpdatedAt(LocalDateTime.now());
    articleMapper.updateById(article);

    if (request.content() != null && oldContentPath != null && !oldContentPath.isBlank()) {
      try {
        objectStorageService.deleteObject(oldContentPath);
      } catch (Exception ex) {
        LOGGER.warn("Failed to delete old article content: {}", oldContentPath, ex);
      }
    }

    if (request.coverImage() != null && oldCoverImage != null && !oldCoverImage.isBlank()) {
      if (!oldCoverImage.equals(request.coverImage().trim())) {
        try {
          objectStorageService.deleteObject(oldCoverImage);
        } catch (Exception ex) {
          LOGGER.warn("Failed to delete old cover image: {}", oldCoverImage, ex);
        }
      }
    }

    replaceTags(articleId, request.tags());

    article.setTags(articleTagMapper.selectTagNamesByArticleId(articleId));
    article.setContent(resolveArticleContent(article.getContent()));
    List<CommentEntity> comments = commentMapper.selectByArticleId(articleId);
    Map<String, Object> logPayload = new HashMap<>();
    logPayload.put("articleId", articleId);
    logPayload.put("title", article.getTitle());
    if (resolvedSummary != null) {
      logPayload.put("summaryAiGenerated", resolvedSummary.aiGenerated());
    }
    activityLogService.log("article_update", user.getId(), logPayload);
    return ViewMapper.articleDetail(article, comments);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_batch_delete", target = "article")
  public ArticleBatchOperationResponse batchDeleteArticles(ArticleBatchDeleteRequest request, UserEntity user) {
    List<Long> articleIds = normalizeArticleIds(request.articleIds());
    if (articleIds.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "articleIds is required");
    }

    List<ArticleEntity> targetArticles = articleMapper.selectList(
      new LambdaQueryWrapper<ArticleEntity>()
        .select(
          ArticleEntity::getId,
          ArticleEntity::getAuthorId,
          ArticleEntity::getAuthorName,
          ArticleEntity::getContent,
          ArticleEntity::getCoverImage
        )
        .in(ArticleEntity::getId, articleIds)
    );
    if (targetArticles.size() != articleIds.size()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "some articles do not exist");
    }

    if (!isAdmin(user)) {
      boolean hasUnauthorized = targetArticles
        .stream()
        .anyMatch(article -> !isArticleOwner(article, user));
      if (hasUnauthorized) {
        throw new BusinessException(HttpStatus.FORBIDDEN, "you can only delete your own articles");
      }
    }

    List<String> storageRefs = collectStorageRefsForDelete(targetArticles, articleIds);
    int affectedCount = articleMapper.delete(new LambdaQueryWrapper<ArticleEntity>().in(ArticleEntity::getId, articleIds));
    StorageCleanupResult cleanupResult = deleteStorageObjects(storageRefs);
    activityLogService.log(
      "article_batch_delete",
      user.getId(),
      Map.of(
        "articleIds",
        articleIds,
        "affectedCount",
        affectedCount,
        "storageDeleteAttempted",
        cleanupResult.attempted(),
        "storageDeleteFailed",
        cleanupResult.failed()
      )
    );
    return new ArticleBatchOperationResponse(affectedCount);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "article_batch_move_category", target = "article")
  public ArticleBatchOperationResponse batchMoveArticlesToCategory(
    ArticleBatchCategoryUpdateRequest request,
    UserEntity user
  ) {
    ensureAdmin(user);
    List<Long> articleIds = normalizeArticleIds(request.articleIds());
    if (articleIds.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "articleIds is required");
    }

    String categoryName = normalizeCategoryName(request.category());
    categoryService.ensureCategoryExists(categoryName);

    int affectedCount = articleMapper.update(
      null,
      new LambdaUpdateWrapper<ArticleEntity>()
        .in(ArticleEntity::getId, articleIds)
        .set(ArticleEntity::getCategory, categoryName)
    );
    activityLogService.log(
      "article_batch_move_category",
      user.getId(),
      Map.of("articleIds", articleIds, "category", categoryName, "affectedCount", affectedCount)
    );
    return new ArticleBatchOperationResponse(affectedCount);
  }

  @Override
  @TrackOperation(name = "article_preview", target = "article")
  public ArticlePreviewResponse previewArticle(ArticleUpdateRequest request, UserEntity user) {
    ensureAdmin(user);

    String title = normalizeValue(request.title());
    String plainContent = normalizeValue(request.content());
    if (title.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "title is required for preview");
    }
    if (plainContent.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "content is required for preview");
    }

    String summary = request.summary() == null ? "" : request.summary().trim();
    String categoryName = normalizeCategoryName(request.category());
    String status = normalizePersistStatus(request.status());
    String coverImage = request.coverImage() == null ? "" : request.coverImage().trim();
    List<String> tags = request.tags() == null ? List.of() : request.tags().stream().filter(Objects::nonNull).map(String::trim).filter(tag -> !tag.isBlank()).distinct().toList();

    return new ArticlePreviewResponse(
      title,
      summary,
      request.content(),
      categoryName,
      status,
      coverImage,
      tags,
      LocalDateTime.now()
    );
  }

  private ArticleEntity requireVisibleArticle(Long articleId, UserEntity viewer) {
    ArticleEntity article = articleMapper.selectById(articleId);
    if (article == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "article not found");
    }
    if ((isDraftStatus(article.getStatus()) || STATUS_SCHEDULED.equals(article.getStatus())) && !isAdmin(viewer)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "article not found");
    }
    return article;
  }

  private void ensureAdmin(UserEntity user) {
    if (!isAdmin(user)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "only admin can publish or edit articles");
    }
  }

  private boolean isAdmin(UserEntity user) {
    return user != null && user.getUsername() != null && ADMIN_USERNAME.equalsIgnoreCase(user.getUsername().trim());
  }

  private boolean isArticleOwner(ArticleEntity article, UserEntity user) {
    if (article == null || user == null) {
      return false;
    }
    if (article.getAuthorId() != null && user.getId() != null) {
      return Objects.equals(article.getAuthorId(), user.getId());
    }
    String articleAuthor = normalizeValue(article.getAuthorName());
    String username = normalizeValue(user.getUsername());
    return !articleAuthor.isBlank() && articleAuthor.equalsIgnoreCase(username);
  }

  private void replaceTags(Long articleId, List<String> tags) {
    if (tags == null) {
      return;
    }
    articleTagMapper.delete(new LambdaQueryWrapper<ArticleTagEntity>().eq(ArticleTagEntity::getArticleId, articleId));
    for (String tag : tags) {
      if (tag == null || tag.isBlank()) {
        continue;
      }
      ArticleTagEntity tagEntity = new ArticleTagEntity();
      tagEntity.setArticleId(articleId);
      tagEntity.setTagName(tag.trim());
      articleTagMapper.insert(tagEntity);
    }
  }

  private String resolveArticleContent(String storedContent) {
    if (storedContent == null || storedContent.isBlank()) {
      return "";
    }
    if (storedContent.startsWith("aliyun/")) {
      String loaded = objectStorageService.loadObjectText(storedContent);
      if (loaded != null && !loaded.isBlank()) {
        return loaded;
      }
    }
    return storedContent;
  }

  private String normalizeValue(String value) {
    return value == null ? "" : value.trim();
  }

  private ResolvedSummary resolveSummary(String title, String summary, String content) {
    String normalizedSummary = normalizeValue(summary);
    if (!normalizedSummary.isBlank()) {
      return new ResolvedSummary(normalizedSummary, false);
    }

    String generated = normalizeValue(aiSummaryService.generateSummary(title, content));
    if (generated.isBlank()) {
      return new ResolvedSummary("", false);
    }
    return new ResolvedSummary(generated, true);
  }

  private String normalizeCategoryName(String value) {
    String normalized = normalizeValue(value);
    return normalized.isBlank() ? "未分类" : normalized;
  }

  private String normalizeCategoryFilter(String category) {
    String normalized = normalizeValue(category);
    if (normalized.isBlank()) {
      return "";
    }
    String lower = normalized.toLowerCase(Locale.ROOT);
    if ("all".equals(lower) || "all-articles".equals(lower) || "全部文章".equals(normalized)) {
      return "";
    }
    return normalized;
  }

  private boolean isDraftStatus(String status) {
    String normalizedStatus = normalizeValue(status).toLowerCase(Locale.ROOT);
    return STATUS_DRAFT.equals(normalizedStatus);
  }

  private String normalizePersistStatus(String status) {
    return normalizePersistStatus(status, null);
  }

  private String normalizePersistStatus(String status, LocalDateTime publishTime) {
    String normalizedStatus = normalizeValue(status).toLowerCase(Locale.ROOT);
    if (STATUS_DRAFT.equals(normalizedStatus)) {
      return STATUS_DRAFT;
    }
    if (publishTime != null && publishTime.isAfter(LocalDateTime.now())) {
      return STATUS_SCHEDULED;
    }
    return STATUS_PUBLISHED;
  }

  private String normalizeStatusFilter(String status, UserEntity viewer) {
    String normalizedStatus = normalizeValue(status).toLowerCase(Locale.ROOT);
    if (normalizedStatus.isBlank()) {
      return STATUS_PUBLISHED;
    }
    if (STATUS_PUBLISHED.equals(normalizedStatus)) {
      return STATUS_PUBLISHED;
    }
    if (STATUS_DRAFT.equals(normalizedStatus)) {
      return isAdmin(viewer) ? STATUS_DRAFT : STATUS_PUBLISHED;
    }
    if ("scheduled".equals(normalizedStatus) || "定时".equals(normalizedStatus)) {
      return isAdmin(viewer) ? STATUS_SCHEDULED : STATUS_PUBLISHED;
    }
    if ("all".equals(normalizedStatus) || "all-status".equals(normalizedStatus)) {
      return isAdmin(viewer) ? "" : STATUS_PUBLISHED;
    }
    return STATUS_PUBLISHED;
  }

  private void applySort(LambdaQueryWrapper<ArticleEntity> queryWrapper, String sort) {
    String normalizedSort = normalizeValue(sort).toLowerCase(Locale.ROOT);
    switch (normalizedSort) {
      case "views":
        queryWrapper.orderByDesc(ArticleEntity::getViews).orderByDesc(ArticleEntity::getCreatedAt);
        break;
      case "likes":
        queryWrapper.orderByDesc(ArticleEntity::getLikes).orderByDesc(ArticleEntity::getCreatedAt);
        break;
      default:
        queryWrapper.orderByDesc(ArticleEntity::getCreatedAt);
        break;
    }
  }

  private List<Long> normalizeArticleIds(List<Long> rawArticleIds) {
    if (rawArticleIds == null) {
      return List.of();
    }
    return rawArticleIds.stream().filter(Objects::nonNull).filter(id -> id > 0).distinct().toList();
  }

  private Map<String, String> resolveAuthorAvatarMap(List<ArticleEntity> articles) {
    if (articles == null || articles.isEmpty()) {
      return Map.of();
    }

    Set<String> authorNames = new HashSet<>();
    for (ArticleEntity article : articles) {
      String authorName = normalizeValue(article.getAuthorName());
      if (!authorName.isBlank()) {
        authorNames.add(authorName);
      }
    }

    if (authorNames.isEmpty()) {
      return Map.of();
    }

    List<UserEntity> authors = userMapper.selectList(
      new LambdaQueryWrapper<UserEntity>()
        .select(UserEntity::getUsername, UserEntity::getAvatarUrl)
        .in(UserEntity::getUsername, authorNames)
    );

    Map<String, String> result = new HashMap<>();
    for (UserEntity author : authors) {
      String key = normalizeAuthorKey(author.getUsername());
      if (!key.isEmpty()) {
        result.put(key, normalizeValue(author.getAvatarUrl()));
      }
    }
    return result;
  }

  private String normalizeAuthorKey(String authorName) {
    return normalizeValue(authorName).toLowerCase(Locale.ROOT);
  }

  private boolean isArticleLikedByUser(Long articleId, Long userId) {
    if (articleId == null || userId == null) {
      return false;
    }
    Long count = articleLikeMapper.selectCount(
      new LambdaQueryWrapper<ArticleLikeEntity>()
        .eq(ArticleLikeEntity::getArticleId, articleId)
        .eq(ArticleLikeEntity::getUserId, userId)
    );
    return count != null && count > 0;
  }

  private boolean isArticleFavoritedByUser(Long articleId, Long userId) {
    if (articleId == null || userId == null) {
      return false;
    }
    Long count = articleFavoriteMapper.selectCount(
      new LambdaQueryWrapper<ArticleFavoriteEntity>()
        .eq(ArticleFavoriteEntity::getArticleId, articleId)
        .eq(ArticleFavoriteEntity::getUserId, userId)
    );
    return count != null && count > 0;
  }

  private int countArticleFavorites(Long articleId) {
    if (articleId == null) {
      return 0;
    }
    Long count = articleFavoriteMapper.selectCount(
      new LambdaQueryWrapper<ArticleFavoriteEntity>()
        .eq(ArticleFavoriteEntity::getArticleId, articleId)
    );
    if (count == null || count <= 0) {
      return 0;
    }
    return count > Integer.MAX_VALUE ? Integer.MAX_VALUE : count.intValue();
  }

  private List<String> collectStorageRefsForDelete(List<ArticleEntity> targetArticles, List<Long> deletingIds) {
    if (targetArticles == null || targetArticles.isEmpty()) {
      return List.of();
    }

    Set<String> refs = new HashSet<>();
    for (ArticleEntity article : targetArticles) {
      String contentPath = normalizeValue(article.getContent());
      if (!contentPath.isBlank() && !isArticleContentReferencedByOthers(contentPath, deletingIds)) {
        refs.add(contentPath);
      }

      String coverRef = normalizeValue(article.getCoverImage());
      if (!coverRef.isBlank() && !isArticleCoverReferencedByOthers(coverRef, deletingIds)) {
        refs.add(coverRef);
      }
    }
    return new ArrayList<>(refs);
  }

  private boolean isArticleContentReferencedByOthers(String contentPath, List<Long> deletingIds) {
    if (contentPath == null || contentPath.isBlank()) {
      return false;
    }
    Long count = articleMapper.selectCount(
      new LambdaQueryWrapper<ArticleEntity>()
        .eq(ArticleEntity::getContent, contentPath)
        .notIn(ArticleEntity::getId, deletingIds)
    );
    return count != null && count > 0;
  }

  private boolean isArticleCoverReferencedByOthers(String coverRef, List<Long> deletingIds) {
    if (coverRef == null || coverRef.isBlank()) {
      return false;
    }
    Long count = articleMapper.selectCount(
      new LambdaQueryWrapper<ArticleEntity>()
        .eq(ArticleEntity::getCoverImage, coverRef)
        .notIn(ArticleEntity::getId, deletingIds)
    );
    return count != null && count > 0;
  }

  private StorageCleanupResult deleteStorageObjects(List<String> refs) {
    if (refs == null || refs.isEmpty()) {
      return new StorageCleanupResult(0, 0);
    }
    int failed = 0;
    for (String ref : refs) {
      try {
        objectStorageService.deleteObject(ref);
      } catch (Exception ex) {
        failed++;
        LOGGER.warn("Failed to delete storage object: {}", ref, ex);
      }
    }
    return new StorageCleanupResult(refs.size(), failed);
  }

  private record StorageCleanupResult(int attempted, int failed) {}

  private record ResolvedSummary(String summary, boolean aiGenerated) {}

  @Override
  public ArticleSummaryResponse getNextArticle(Long currentArticleId) {
    ArticleEntity current = articleMapper.selectById(currentArticleId);
    if (current == null) {
      return null;
    }

    LambdaQueryWrapper<ArticleEntity> queryWrapper = new LambdaQueryWrapper<>();
    queryWrapper.ne(ArticleEntity::getId, currentArticleId)
      .eq(ArticleEntity::getStatus, STATUS_PUBLISHED)
      .orderByDesc(ArticleEntity::getCreatedAt)
      .last("LIMIT 1");

    ArticleEntity nextArticle = articleMapper.selectOne(queryWrapper);
    if (nextArticle == null) {
      return null;
    }

    nextArticle.setTags(articleTagMapper.selectTagNamesByArticleId(nextArticle.getId()));
    return ViewMapper.summary(nextArticle);
  }

  @Override
  public void publishScheduledArticle(Long articleId) {
    ArticleEntity article = articleMapper.selectById(articleId);
    if (article == null) {
      LOGGER.warn("Scheduled article not found: {}", articleId);
      return;
    }

    if (!STATUS_SCHEDULED.equals(article.getStatus())) {
      LOGGER.info("Article {} is not in scheduled status, skipping publish", articleId);
      return;
    }

    LocalDateTime now = LocalDateTime.now();
    if (article.getPublishTime() != null && article.getPublishTime().isAfter(now)) {
      LOGGER.info("Article {} publish time {} is in the future, skipping", articleId, article.getPublishTime());
      return;
    }

    article.setStatus(STATUS_PUBLISHED);
    article.setPublishTime(null);
    article.setUpdatedAt(now);
    articleMapper.updateById(article);

    LOGGER.info("Scheduled article {} published successfully", articleId);
  }

  @Override
  public List<ArticleSummaryResponse> searchDrafts(String keyword, UserEntity user) {
    ensureAdmin(user);

    LambdaQueryWrapper<ArticleEntity> queryWrapper = new LambdaQueryWrapper<>();
    queryWrapper.eq(ArticleEntity::getStatus, STATUS_DRAFT);

    String normalizedKeyword = normalizeValue(keyword);
    if (!normalizedKeyword.isBlank()) {
      queryWrapper.like(ArticleEntity::getTitle, normalizedKeyword);
    }

    queryWrapper.orderByDesc(ArticleEntity::getUpdatedAt);
    queryWrapper.last("LIMIT 10");

    List<ArticleEntity> articles = articleMapper.selectList(queryWrapper);
    Map<String, String> authorAvatarMap = resolveAuthorAvatarMap(articles);
    List<ArticleSummaryResponse> responses = new ArrayList<>();
    for (ArticleEntity article : articles) {
      article.setTags(articleTagMapper.selectTagNamesByArticleId(article.getId()));
      String authorAvatarUrl = authorAvatarMap.get(normalizeAuthorKey(article.getAuthorName()));
      responses.add(ViewMapper.articleSummary(article, authorAvatarUrl));
    }
    return responses;
  }
}
