package com.tche.blog.dto.article;

import java.time.LocalDateTime;
import java.util.List;

public record ArticlePreviewResponse(
  String title,
  String summary,
  String content,
  String category,
  String status,
  String coverImage,
  List<String> tags,
  LocalDateTime previewAt
) {}
