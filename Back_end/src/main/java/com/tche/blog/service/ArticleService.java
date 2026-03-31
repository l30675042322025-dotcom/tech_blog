package com.tche.blog.service;

import java.util.List;

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
import org.springframework.web.multipart.MultipartFile;

public interface ArticleService {
  List<ArticleSummaryResponse> listArticles();
  List<ArticleSummaryResponse> listArticles(String authorName);
  List<ArticleSummaryResponse> listArticles(
    String authorName,
    String category,
    String keyword,
    String sort,
    String status
  );
  List<ArticleSummaryResponse> listArticles(
    String authorName,
    String category,
    String keyword,
    String sort,
    String status,
    UserEntity viewer
  );
  ArticleDetailResponse getArticle(Long articleId);
  ArticleDetailResponse getArticle(Long articleId, UserEntity viewer);
  List<CommentResponse> listComments(Long articleId);
  List<CommentResponse> listComments(Long articleId, UserEntity viewer);
  LikeResponse likeArticle(Long articleId, UserEntity user);
  FavoriteResponse favoriteArticle(Long articleId, UserEntity user);
  CommentResponse addComment(Long articleId, CommentCreateRequest request, UserEntity user);
  ArticleCoverUploadResponse uploadCover(UserEntity user, MultipartFile file);
  ArticleImageUploadResponse uploadArticleImage(UserEntity user, MultipartFile file);
  ArticleDetailResponse createArticle(ArticleUpdateRequest request, UserEntity user);
  ArticleDetailResponse updateArticle(Long articleId, ArticleUpdateRequest request, UserEntity user);
  ArticleBatchOperationResponse batchDeleteArticles(ArticleBatchDeleteRequest request, UserEntity user);
  ArticleBatchOperationResponse batchMoveArticlesToCategory(ArticleBatchCategoryUpdateRequest request, UserEntity user);
  ArticlePreviewResponse previewArticle(ArticleUpdateRequest request, UserEntity user);
  ArticleSummaryResponse getNextArticle(Long currentArticleId);
  void publishScheduledArticle(Long articleId);
  List<ArticleSummaryResponse> searchDrafts(String keyword, UserEntity user);
}
