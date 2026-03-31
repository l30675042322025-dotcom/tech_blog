package com.tche.blog.controller;

import java.util.List;

import org.springframework.validation.annotation.Validated;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.common.BusinessException;
import com.tche.blog.dto.article.ArticleBatchCategoryUpdateRequest;
import com.tche.blog.dto.article.ArticleBatchDeleteRequest;
import com.tche.blog.dto.article.ArticleBatchOperationResponse;
import com.tche.blog.dto.article.ArticleCoverUploadResponse;
import com.tche.blog.dto.article.ArticleDetailResponse;
import com.tche.blog.dto.article.ArticleImageUploadResponse;
import com.tche.blog.dto.article.ArticlePreviewResponse;
import com.tche.blog.dto.article.ArticleSummaryResponse;
import com.tche.blog.dto.article.ArticleUpdateRequest;
import com.tche.blog.dto.article.CommentCreateRequest;
import com.tche.blog.dto.article.CommentResponse;
import com.tche.blog.dto.article.FavoriteResponse;
import com.tche.blog.dto.article.LikeResponse;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.ArticleService;
import com.tche.blog.service.AuthService;

import jakarta.annotation.Resource;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/articles")
public class ArticleController {
  @Resource
  private ArticleService articleService;

  @Resource
  private AuthService authService;

  @GetMapping
  public ApiResponse<List<ArticleSummaryResponse>> listArticles(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam(value = "authorName", required = false) String authorName,
    @RequestParam(value = "category", required = false) String category,
    @RequestParam(value = "keyword", required = false) String keyword,
    @RequestParam(value = "sort", required = false) String sort,
    @RequestParam(value = "status", required = false) String status
  ) {
    return ApiResponse.ok(articleService.listArticles(authorName, category, keyword, sort, status, resolveOptionalUser(authorization)));
  }

  @GetMapping("/drafts/search")
  public ApiResponse<List<ArticleSummaryResponse>> searchDrafts(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam(value = "keyword", required = false) String keyword
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.searchDrafts(keyword, user));
  }

  @GetMapping("/{articleId}")
  public ApiResponse<ArticleDetailResponse> getArticle(
    @PathVariable Long articleId,
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    return ApiResponse.ok(articleService.getArticle(articleId, resolveOptionalUser(authorization)));
  }

  @GetMapping("/{articleId}/next")
  public ApiResponse<ArticleSummaryResponse> getNextArticle(
    @PathVariable Long articleId
  ) {
    return ApiResponse.ok(articleService.getNextArticle(articleId));
  }

  @GetMapping("/{articleId}/comments")
  public ApiResponse<List<CommentResponse>> listComments(
    @PathVariable Long articleId,
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    return ApiResponse.ok(articleService.listComments(articleId, resolveOptionalUser(authorization)));
  }

  @PostMapping("/{articleId}/like")
  public ApiResponse<LikeResponse> likeArticle(
    @PathVariable Long articleId,
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.likeArticle(articleId, user));
  }

  @PostMapping("/{articleId}/favorite")
  public ApiResponse<FavoriteResponse> favoriteArticle(
    @PathVariable Long articleId,
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.favoriteArticle(articleId, user));
  }

  @PostMapping("/{articleId}/comments")
  public ApiResponse<CommentResponse> addComment(
    @PathVariable Long articleId,
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody CommentCreateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.addComment(articleId, request, user));
  }

  @PostMapping(value = "/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ArticleCoverUploadResponse> uploadCover(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam("file") MultipartFile file
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.uploadCover(user, file));
  }

  @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ArticleImageUploadResponse> uploadImage(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam("file") MultipartFile file
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.uploadArticleImage(user, file));
  }

  @PostMapping
  public ApiResponse<ArticleDetailResponse> createArticle(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody ArticleUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.createArticle(request, user));
  }

  @PutMapping("/{articleId}")
  public ApiResponse<ArticleDetailResponse> updateArticle(
    @PathVariable Long articleId,
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody ArticleUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.updateArticle(articleId, request, user));
  }

  @PostMapping("/preview")
  public ApiResponse<ArticlePreviewResponse> previewArticle(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody ArticleUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.previewArticle(request, user));
  }

  @PostMapping("/batch/delete")
  public ApiResponse<ArticleBatchOperationResponse> batchDeleteArticles(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody ArticleBatchDeleteRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.batchDeleteArticles(request, user));
  }

  @PostMapping("/batch/category")
  public ApiResponse<ArticleBatchOperationResponse> batchMoveArticlesToCategory(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody ArticleBatchCategoryUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(articleService.batchMoveArticlesToCategory(request, user));
  }

  private UserEntity resolveOptionalUser(String authorization) {
    String token = authService.extractBearerToken(authorization);
    if (token == null || token.isBlank()) {
      return null;
    }
    try {
      return authService.requireUser(authorization);
    } catch (Exception ex) {
      return null;
    }
  }
}
