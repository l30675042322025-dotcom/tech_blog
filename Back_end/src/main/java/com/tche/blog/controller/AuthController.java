package com.tche.blog.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.dto.auth.AuthResponse;
import com.tche.blog.dto.auth.CaptchaResponse;
import com.tche.blog.dto.auth.LoginRequest;
import com.tche.blog.dto.auth.RegisterRequest;
import com.tche.blog.dto.auth.SendRegisterEmailCodeRequest;
import com.tche.blog.service.AuthService;
import com.tche.blog.service.CaptchaService;
import com.tche.blog.service.EmailVerificationService;
import com.tche.blog.service.ViewMapper;

import jakarta.annotation.Resource;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/auth")
public class AuthController {
  @Resource
  private AuthService authService;
  @Resource
  private CaptchaService captchaService;
  @Resource
  private EmailVerificationService emailVerificationService;

  @PostMapping("/register")
  public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
    return ApiResponse.ok(authService.register(request));
  }

  @PostMapping("/register/email-code")
  public ApiResponse<Object> sendRegisterEmailCode(@Valid @RequestBody SendRegisterEmailCodeRequest request) {
    emailVerificationService.sendRegisterCode(request.email());
    return ApiResponse.ok("邮箱验证码已发送，请注意查收", null);
  }

  @PostMapping("/login")
  public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
    return ApiResponse.ok(authService.login(request));
  }

  @GetMapping("/captcha")
  public ApiResponse<CaptchaResponse> captcha() {
    return ApiResponse.ok(captchaService.createCaptcha());
  }

  @GetMapping("/me")
  public ApiResponse<Object> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
    return ApiResponse.ok(ViewMapper.user(authService.requireUser(authorization)));
  }

  @PostMapping("/logout")
  public ApiResponse<Object> logout(
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    authService.logout(authorization);
    return ApiResponse.ok("logout success", null);
  }
}
