package com.tche.blog.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
  @NotBlank(message = "username is required")
  @Size(min = 2, max = 32, message = "username length must be 2-32")
  String username,
  @NotBlank(message = "email is required")
  @Email(message = "email format is invalid")
  String email,
  @NotBlank(message = "password is required")
  @Size(min = 6, max = 64, message = "password length must be 6-64")
  String password,
  @NotBlank(message = "邮箱验证码不能为空")
  @Size(min = 6, max = 6, message = "邮箱验证码必须为6位数字")
  @Pattern(regexp = "\\d{6}", message = "邮箱验证码必须为6位数字")
  String emailCode
) {}
