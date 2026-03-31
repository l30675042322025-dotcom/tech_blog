package com.tche.blog.dto.auth;

import com.tche.blog.dto.UserView;

public record AuthResponse(String token, UserView user) {}
