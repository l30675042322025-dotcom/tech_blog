package com.tche.blog.service.impl;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import javax.imageio.ImageIO;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.tche.blog.common.BusinessException;
import com.tche.blog.dto.auth.CaptchaResponse;
import com.tche.blog.service.CaptchaService;

@Service
public class CaptchaServiceImpl implements CaptchaService {
  private static final int CAPTCHA_LENGTH = 4;
  private static final int CAPTCHA_WIDTH = 120;
  private static final int CAPTCHA_HEIGHT = 42;
  private static final int EXPIRE_SECONDS = 120;
  private static final String CODE_POOL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static final SecureRandom RANDOM = new SecureRandom();

  private final ConcurrentMap<String, CaptchaEntry> captchaStore = new ConcurrentHashMap<>();

  @Override
  public CaptchaResponse createCaptcha() {
    cleanupExpired();
    String captchaId = UUID.randomUUID().toString().replace("-", "");
    String captchaCode = generateCode();
    String captchaImage = toImageDataUrl(captchaCode);
    captchaStore.put(captchaId, new CaptchaEntry(captchaCode, LocalDateTime.now().plusSeconds(EXPIRE_SECONDS)));
    return new CaptchaResponse(captchaId, captchaImage);
  }

  @Override
  public void verifyCaptcha(String captchaId, String captchaCode) {
    cleanupExpired();
    String normalizedId = normalize(captchaId);
    String normalizedCode = normalize(captchaCode);
    if (normalizedId.isBlank() || normalizedCode.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请输入验证码");
    }

    CaptchaEntry entry = captchaStore.get(normalizedId);
    if (entry == null || entry.expiresAt().isBefore(LocalDateTime.now())) {
      captchaStore.remove(normalizedId);
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码已过期，请刷新后重试");
    }

    if (!entry.code().equalsIgnoreCase(normalizedCode)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码错误");
    }

    captchaStore.remove(normalizedId);
  }

  private String generateCode() {
    StringBuilder code = new StringBuilder(CAPTCHA_LENGTH);
    for (int i = 0; i < CAPTCHA_LENGTH; i++) {
      int index = RANDOM.nextInt(CODE_POOL.length());
      code.append(CODE_POOL.charAt(index));
    }
    return code.toString();
  }

  private String toImageDataUrl(String code) {
    BufferedImage image = new BufferedImage(CAPTCHA_WIDTH, CAPTCHA_HEIGHT, BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = image.createGraphics();
    try {
      graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
      graphics.setColor(new Color(246, 250, 255));
      graphics.fillRect(0, 0, CAPTCHA_WIDTH, CAPTCHA_HEIGHT);

      graphics.setStroke(new BasicStroke(1.2f));
      for (int i = 0; i < 6; i++) {
        graphics.setColor(randomColor(120, 210));
        int x1 = randomInt(0, CAPTCHA_WIDTH - 1);
        int y1 = randomInt(0, CAPTCHA_HEIGHT - 1);
        int x2 = randomInt(0, CAPTCHA_WIDTH - 1);
        int y2 = randomInt(0, CAPTCHA_HEIGHT - 1);
        graphics.drawLine(x1, y1, x2, y2);
      }

      graphics.setFont(new Font("Arial", Font.BOLD, 28));
      for (int i = 0; i < code.length(); i++) {
        graphics.setColor(randomColor(40, 140));
        int x = 14 + i * 25 + randomInt(0, 2);
        int y = 30 + randomInt(0, 4);
        graphics.drawString(String.valueOf(code.charAt(i)), x, y);
      }
    } finally {
      graphics.dispose();
    }

    try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      ImageIO.write(image, "png", output);
      return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
    } catch (IOException ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "验证码生成失败，请稍后重试");
    }
  }

  private Color randomColor(int min, int max) {
    int red = randomInt(min, max);
    int green = randomInt(min, max);
    int blue = randomInt(min, max);
    return new Color(red, green, blue);
  }

  private int randomInt(int min, int max) {
    if (max <= min) {
      return min;
    }
    return min + RANDOM.nextInt(max - min + 1);
  }

  private void cleanupExpired() {
    LocalDateTime now = LocalDateTime.now();
    captchaStore.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
  }

  private String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }

  private record CaptchaEntry(String code, LocalDateTime expiresAt) {}
}
