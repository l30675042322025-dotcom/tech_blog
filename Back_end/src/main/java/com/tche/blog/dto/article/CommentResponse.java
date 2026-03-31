package com.tche.blog.dto.article;

import java.time.LocalDateTime;

public record CommentResponse(
  Long id,
  Long articleId,
  Long userId,
  String userName,
  String userAvatarUrl,
  String content,
  int likes,
  LocalDateTime createdAt
) {}
