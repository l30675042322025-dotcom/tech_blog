package com.tche.blog.service;

import java.util.List;

import com.tche.blog.dto.UserView;
import com.tche.blog.dto.article.ArticleDetailResponse;
import com.tche.blog.dto.article.ArticleSummaryResponse;
import com.tche.blog.dto.article.CommentResponse;
import com.tche.blog.model.ArticleEntity;
import com.tche.blog.model.CommentEntity;
import com.tche.blog.model.UserEntity;

public final class ViewMapper {
  private ViewMapper() {}

  public static UserView user(UserEntity user) {
    return new UserView(
      user.getId(),
      user.getUsername(),
      user.getEmail(),
      user.getAvatarUrl(),
      user.getLastAvatarObjectKey(),
      user.getNickname(),
      user.getMobile(),
      user.getBio(),
      user.getGithub(),
      user.getTwitter(),
      user.getWebsite(),
      user.getCreatedAt()
    );
  }

  public static CommentResponse comment(CommentEntity comment) {
    return new CommentResponse(
      comment.getId(),
      comment.getArticleId(),
      comment.getUserId(),
      comment.getUserName(),
      comment.getUserAvatarUrl(),
      comment.getContent(),
      comment.getLikes(),
      comment.getCreatedAt()
    );
  }

  public static ArticleSummaryResponse articleSummary(ArticleEntity article, String authorAvatarUrl) {
    return new ArticleSummaryResponse(
      article.getId(),
      article.getTitle(),
      article.getSummary(),
      article.isSummaryAiGenerated(),
      article.getCategory(),
      article.getStatus(),
      article.getCoverImage(),
      article.getAuthorName(),
      authorAvatarUrl,
      article.getViews(),
      article.getLikes(),
      article.getCreatedAt(),
      article.getTags(),
      article.getPublishTime()
    );
  }

  public static ArticleSummaryResponse summary(ArticleEntity article) {
    return articleSummary(article, null);
  }

  public static ArticleDetailResponse articleDetail(ArticleEntity article, List<CommentEntity> comments) {
    return articleDetail(article, comments, false, false, 0);
  }

  public static ArticleDetailResponse articleDetail(
    ArticleEntity article,
    List<CommentEntity> comments,
    boolean liked,
    boolean favorited,
    int favorites
  ) {
    List<CommentResponse> commentViews = comments.stream().map(ViewMapper::comment).toList();
    return new ArticleDetailResponse(
      article.getId(),
      article.getTitle(),
      article.getSummary(),
      article.isSummaryAiGenerated(),
      article.getContent(),
      article.getCategory(),
      article.getStatus(),
      article.getCoverImage(),
      article.getAuthorName(),
      article.getViews(),
      article.getLikes(),
      favorites,
      liked,
      favorited,
      article.getCreatedAt(),
      article.getUpdatedAt(),
      article.getTags(),
      commentViews,
      article.getPublishTime()
    );
  }
}
