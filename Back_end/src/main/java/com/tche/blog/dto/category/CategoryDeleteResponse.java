package com.tche.blog.dto.category;

public record CategoryDeleteResponse(
  Long id,
  String name,
  int movedArticleCount,
  String targetCategoryName
) {}
