package com.tche.blog.dto.article;

public record LikeResponse(Long articleId, int likes, boolean liked) {}
