package com.tche.blog.service;

import com.tche.blog.dto.auth.CaptchaResponse;

public interface CaptchaService {
  CaptchaResponse createCaptcha();
  void verifyCaptcha(String captchaId, String captchaCode);
}
