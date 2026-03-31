package com.tche.blog.dto.author;

import java.util.List;

import com.tche.blog.dto.article.ArticleSummaryResponse;

public record AuthorProfileResponse(
  Long id,
  String name,
  String avatarUrl,
  String nickname,
  String bio,
  String github,
  String twitter,
  String website,
  List<ArticleSummaryResponse> articles
) {}
