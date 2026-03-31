package com.tche.blog.dto.article;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentCreateRequest(
  @NotBlank(message = "content is required")
  @Size(max = 500, message = "content length must be <= 500")
  String content
) {}
