package com.tche.blog.dto.article;

import java.time.LocalDateTime;
import java.util.List;

public record ArticleSummaryResponse(
  Long id,
  String title,
  String summary,
  boolean summaryAiGenerated,
  String category,
  String status,
  String coverImage,
  String authorName,
  String authorAvatarUrl,
  int views,
  int likes,
  LocalDateTime createdAt,
  List<String> tags,
  LocalDateTime publishTime
) {}
