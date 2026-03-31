package com.tche.blog.service.impl;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import com.tche.blog.common.BusinessException;
import com.tche.blog.service.EmailVerificationService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EmailVerificationServiceImpl implements EmailVerificationService {
  private static final int CODE_EXPIRE_MINUTES = 10;
  private static final int RESEND_COOLDOWN_SECONDS = 60;
  private static final SecureRandom RANDOM = new SecureRandom();

  private final JavaMailSender mailSender;
  private final ConcurrentHashMap<String, RegisterEmailCodeRecord> registerCodeStore = new ConcurrentHashMap<>();

  @Value("${spring.mail.username:}")
  private String mailFrom;

  @Override
  public void sendRegisterCode(String email) {
    String normalizedEmail = normalizeEmail(email);
    Instant now = Instant.now();

    RegisterEmailCodeRecord current = registerCodeStore.get(normalizedEmail);
    if (current != null && now.isBefore(current.sentAt().plusSeconds(RESEND_COOLDOWN_SECONDS))) {
      long waitSeconds = current.sentAt().plusSeconds(RESEND_COOLDOWN_SECONDS).getEpochSecond() - now.getEpochSecond();
      if (waitSeconds < 1) {
        waitSeconds = 1;
      }
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码发送频繁，请 " + waitSeconds + " 秒后再试");
    }

    String code = generateCode();
    sendEmail(normalizedEmail, code);
    registerCodeStore.put(
      normalizedEmail,
      new RegisterEmailCodeRecord(code, now.plusSeconds(CODE_EXPIRE_MINUTES * 60L), now)
    );
  }

  @Override
  public void verifyRegisterCode(String email, String code) {
    String normalizedEmail = normalizeEmail(email);
    String normalizedCode = code == null ? "" : code.trim();
    if (normalizedCode.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邮箱验证码不能为空");
    }

    RegisterEmailCodeRecord current = registerCodeStore.get(normalizedEmail);
    if (current == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请先发送邮箱验证码");
    }

    Instant now = Instant.now();
    if (now.isAfter(current.expiresAt())) {
      registerCodeStore.remove(normalizedEmail, current);
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邮箱验证码已过期，请重新获取");
    }

    if (!current.code().equals(normalizedCode)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邮箱验证码错误");
    }

    registerCodeStore.remove(normalizedEmail, current);
  }

  private String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  private String generateCode() {
    return String.format("%06d", RANDOM.nextInt(1_000_000));
  }

  private void sendEmail(String to, String code) {
    String sender = mailFrom == null ? "" : mailFrom.trim();
    if (sender.isEmpty()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "邮件服务未配置，请先设置 MAIL_USERNAME");
    }

    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(sender);
    message.setTo(to);
    message.setSubject("注册验证码");
    message.setText(
      "您正在进行注册操作，验证码为：" +
      code +
      "，10分钟内有效。\n如非本人操作，请忽略本邮件。"
    );

    try {
      mailSender.send(message);
    } catch (MailException ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "邮箱验证码发送失败，请稍后重试");
    }
  }

  private record RegisterEmailCodeRecord(String code, Instant expiresAt, Instant sentAt) {}
}
