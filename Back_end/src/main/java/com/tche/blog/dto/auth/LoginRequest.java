package com.tche.blog.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LoginRequest(
  @NotBlank(message = "请输入账号")
  String account,
  @NotBlank(message = "请输入密码")
  String password,
  @NotBlank(message = "验证码标识不能为空")
  String captchaId,
  @NotBlank(message = "请输入验证码")
  @Size(min = 4, max = 4, message = "验证码必须为4位")
  @Pattern(regexp = "^[A-Za-z0-9]{4}$", message = "验证码只能包含字母或数字")
  String captchaCode
) {}
