package com.tche.blog.service.impl;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.tche.blog.common.BusinessException;
import com.tche.blog.dto.article.ArticleSummaryResponse;
import com.tche.blog.dto.author.AuthorProfileResponse;
import com.tche.blog.mapper.UserMapper;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.ArticleService;
import com.tche.blog.service.AuthorService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthorServiceImpl implements AuthorService {
  private final UserMapper userMapper;
  private final ArticleService articleService;

  @Override
  public AuthorProfileResponse getAuthorProfile(String username) {
    String normalizedUsername = username == null ? "" : username.trim();
    if (normalizedUsername.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "username is required");
    }

    UserEntity author = userMapper
      .selectByUsername(normalizedUsername)
      .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "author not found"));

    List<ArticleSummaryResponse> articles = articleService.listArticles(author.getUsername());
    return new AuthorProfileResponse(
      author.getId(),
      author.getUsername(),
      author.getAvatarUrl(),
      author.getNickname(),
      author.getBio(),
      author.getGithub(),
      author.getTwitter(),
      author.getWebsite(),
      articles
    );
  }
}
