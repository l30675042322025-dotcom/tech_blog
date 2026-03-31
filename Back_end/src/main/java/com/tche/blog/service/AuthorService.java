package com.tche.blog.service;

import com.tche.blog.dto.author.AuthorProfileResponse;

public interface AuthorService {
  AuthorProfileResponse getAuthorProfile(String username);
}
