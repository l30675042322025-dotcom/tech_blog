package com.tche.blog.dto.essay;

import java.time.LocalDateTime;

public record EssayDetailResponse(
  Long id,
  String title,
  String location,
  String coverImage,
  String content,
  String authorName,
  String authorNickname,
  Boolean hidden,
  LocalDateTime createdAt,
  LocalDateTime updatedAt
) {}
