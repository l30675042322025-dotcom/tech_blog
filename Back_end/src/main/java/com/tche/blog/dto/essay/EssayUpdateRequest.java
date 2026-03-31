package com.tche.blog.dto.essay;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EssayUpdateRequest(
  @NotBlank(message = "title is required")
  @Size(max = 200, message = "title length must be <= 200")
  String title,
  @Size(max = 120, message = "location length must be <= 120")
  String location,
  @Size(max = 512, message = "coverImage length must be <= 512")
  String coverImage,
  @NotBlank(message = "content is required")
  String content,
  Boolean hidden
) {}
