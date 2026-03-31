package com.tche.blog.dto;

import java.time.LocalDateTime;

public record UserView(
  Long id,
  String name,
  String email,
  String avatarUrl,
  String lastAvatarObjectKey,
  String nickname,
  String mobile,
  String bio,
  String github,
  String twitter,
  String website,
  LocalDateTime createdAt
) {}
