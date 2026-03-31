package com.tche.blog.dto.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoryCreateRequest(
  @NotBlank(message = "category name is required")
  @Size(max = 64, message = "category name length must be <= 64")
  String name
) {}
