package com.tche.blog.dto.article;

import java.time.LocalDateTime;
import java.util.List;

public record ArticleDetailResponse(
  Long id,
  String title,
  String summary,
  boolean summaryAiGenerated,
  String content,
  String category,
  String status,
  String coverImage,
  String authorName,
  int views,
  int likes,
  int favorites,
  boolean liked,
  boolean favorited,
  LocalDateTime createdAt,
  LocalDateTime updatedAt,
  List<String> tags,
  List<CommentResponse> comments,
  LocalDateTime publishTime
) {}
