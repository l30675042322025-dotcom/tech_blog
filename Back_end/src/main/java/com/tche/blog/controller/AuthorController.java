package com.tche.blog.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.dto.author.AuthorProfileResponse;
import com.tche.blog.service.AuthorService;

import jakarta.annotation.Resource;

@RestController
@RequestMapping("/api/authors")
public class AuthorController {
  @Resource
  private AuthorService authorService;

  @GetMapping("/{username}")
  public ApiResponse<AuthorProfileResponse> getAuthorProfile(@PathVariable String username) {
    return ApiResponse.ok(authorService.getAuthorProfile(username));
  }
}
