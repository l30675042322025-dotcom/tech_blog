package com.tche.blog.model;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ObjectType {
  AVATAR("avatar", "avatar"),
  LOG("log", "log"),
  ARTICLE("article", "article"),
  ARTICLE_IMAGE("article", "article-image");

  private final String folder;
  private final String label;
}
