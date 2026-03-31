package com.tche.blog.dto.article;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ArticleBatchCategoryUpdateRequest(
  @NotEmpty(message = "articleIds is required") List<@NotNull @Positive Long> articleIds,
  @NotBlank(message = "category is required")
  @Size(max = 64, message = "category length must be <= 64")
  String category
) {}
