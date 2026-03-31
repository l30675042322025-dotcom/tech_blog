package com.tche.blog.dto.essay;

import java.time.LocalDateTime;

public record EssaySummaryResponse(
  Long id,
  String title,
  String excerpt,
  String coverImage,
  String location,
  String authorName,
  String authorNickname,
  Boolean hidden,
  LocalDateTime createdAt,
  LocalDateTime publishedAt
) {}
