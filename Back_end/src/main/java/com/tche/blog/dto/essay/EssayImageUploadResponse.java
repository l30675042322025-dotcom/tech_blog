package com.tche.blog.dto.essay;

public record EssayImageUploadResponse(
  String imageUrl,
  String objectKey,
  String fileName
) {}
