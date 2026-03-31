package com.tche.blog.service;

public interface EmailVerificationService {
  void sendRegisterCode(String email);
  void verifyRegisterCode(String email, String code);
}
