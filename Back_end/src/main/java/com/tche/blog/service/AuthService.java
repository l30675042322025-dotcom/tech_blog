package com.tche.blog.service;

import com.tche.blog.dto.auth.AuthResponse;
import com.tche.blog.dto.auth.LoginRequest;
import com.tche.blog.dto.auth.RegisterRequest;
import com.tche.blog.model.UserEntity;

public interface AuthService {
  AuthResponse register(RegisterRequest request);
  AuthResponse login(LoginRequest request);
  void logout(String authorizationHeader);
  UserEntity requireUser(String authorizationHeader);
  String extractBearerToken(String authorizationHeader);
}
