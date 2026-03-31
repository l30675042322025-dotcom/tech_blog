package com.tche.blog.dto.article;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ArticleUpdateRequest(
  @Size(max = 200, message = "title length must be <= 200")
  String title,
  @Size(max = 1000, message = "summary length must be <= 1000")
  String summary,
  String content,
  @Size(max = 64, message = "category length must be <= 64")
  String category,
  String coverImage,
  @Pattern(regexp = "(?i)draft|published", message = "status must be draft or published")
  String status,
  List<String> tags,
  LocalDateTime publishTime
) {}
