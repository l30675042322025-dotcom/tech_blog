package com.tche.blog.dto.article;

public record FavoriteResponse(Long articleId, int favorites, boolean favorited) {}
