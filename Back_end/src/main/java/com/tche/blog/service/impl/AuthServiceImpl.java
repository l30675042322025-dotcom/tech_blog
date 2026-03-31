package com.tche.blog.service.impl;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.tche.blog.aop.TrackOperation;
import com.tche.blog.common.BusinessException;
import com.tche.blog.context.OperatorContextHolder;
import com.tche.blog.context.OperatorInfo;
import com.tche.blog.dto.auth.AuthResponse;
import com.tche.blog.dto.auth.LoginRequest;
import com.tche.blog.dto.auth.RegisterRequest;
import com.tche.blog.mapper.UserMapper;
import com.tche.blog.mapper.UserTokenMapper;
import com.tche.blog.model.UserEntity;
import com.tche.blog.model.UserTokenEntity;
import com.tche.blog.service.ActivityLogService;
import com.tche.blog.service.AuthService;
import com.tche.blog.service.CaptchaService;
import com.tche.blog.service.EmailVerificationService;
import com.tche.blog.service.ViewMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
  private static final PasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

  private final UserMapper userMapper;
  private final UserTokenMapper userTokenMapper;
  private final ActivityLogService activityLogService;
  private final CaptchaService captchaService;
  private final EmailVerificationService emailVerificationService;

  @Override
  @TrackOperation(name = "register", target = "user")
  public AuthResponse register(RegisterRequest request) {
    String username = request.username().trim();
    String email = request.email().trim().toLowerCase(Locale.ROOT);
    String password = request.password();
    emailVerificationService.verifyRegisterCode(email, request.emailCode());

    long usernameCount = userMapper.selectCount(
      new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getUsername, username)
    );
    if (usernameCount > 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "username already exists");
    }

    long emailCount = userMapper.selectCount(
      new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email)
    );
    if (emailCount > 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "email already exists");
    }

    UserEntity user = new UserEntity();
    user.setUsername(username);
    user.setEmail(email);
    user.setPassword(PASSWORD_ENCODER.encode(password));
    user.setAvatarUrl("https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=160&q=80");
    userMapper.insert(user);

    String token = issueToken(user.getId());
    OperatorContextHolder.set(new OperatorInfo(user.getId(), user.getUsername()));
    activityLogService.log("register_success", user.getId(), Map.of("email", email));
    return new AuthResponse(token, ViewMapper.user(user));
  }

  @Override
  @TrackOperation(name = "login", target = "user")
  public AuthResponse login(LoginRequest request) {
    captchaService.verifyCaptcha(request.captchaId(), request.captchaCode());

    String account = request.account().trim();
    UserEntity user = userMapper
      .selectByAccount(account)
      .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "账号或密码错误"));

    if (!verifyPassword(user, request.password())) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "账号或密码错误");
    }

    String token = issueToken(user.getId());
    OperatorContextHolder.set(new OperatorInfo(user.getId(), user.getUsername()));
    activityLogService.log("login_success", user.getId(), Map.of("account", account));
    return new AuthResponse(token, ViewMapper.user(user));
  }

  @Override
  @TrackOperation(name = "logout", target = "token")
  public void logout(String authorizationHeader) {
    String token = extractBearerToken(authorizationHeader);
    if (token == null || token.isBlank()) {
      return;
    }

    UserTokenEntity tokenEntity = userTokenMapper.selectValidToken(token).orElse(null);
    if (tokenEntity != null) {
      UserEntity user = userMapper.selectById(tokenEntity.getUserId());
      if (user != null) {
        OperatorContextHolder.set(new OperatorInfo(user.getId(), user.getUsername()));
        activityLogService.log("logout", user.getId(), Map.of());
      }
    }
    userTokenMapper.deleteById(token);
  }

  @Override
  public UserEntity requireUser(String authorizationHeader) {
    String token = extractBearerToken(authorizationHeader);
    if (token == null || token.isBlank()) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "authorization token is required");
    }

    UserTokenEntity tokenEntity = userTokenMapper
      .selectValidToken(token)
      .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "token is invalid or expired"));

    UserEntity user = userMapper.selectById(tokenEntity.getUserId());
    if (user == null) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "token is invalid or expired");
    }

    userTokenMapper.update(
      null,
      new LambdaUpdateWrapper<UserTokenEntity>()
        .eq(UserTokenEntity::getToken, token)
        .set(UserTokenEntity::getLastSeenAt, LocalDateTime.now())
    );

    OperatorContextHolder.set(new OperatorInfo(user.getId(), user.getUsername()));
    return user;
  }

  @Override
  public String extractBearerToken(String authorizationHeader) {
    if (authorizationHeader == null || authorizationHeader.isBlank()) {
      return null;
    }
    String value = authorizationHeader.trim();
    if (value.regionMatches(true, 0, "Bearer ", 0, 7)) {
      return value.substring(7).trim();
    }
    return value;
  }

  private String issueToken(Long userId) {
    String token = UUID.randomUUID().toString().replace("-", "");
    UserTokenEntity tokenEntity = new UserTokenEntity();
    tokenEntity.setToken(token);
    tokenEntity.setUserId(userId);
    tokenEntity.setExpiresAt(LocalDateTime.now().plusDays(7));
    tokenEntity.setLastSeenAt(LocalDateTime.now());
    userTokenMapper.insert(tokenEntity);
    return token;
  }

  private boolean verifyPassword(UserEntity user, String rawPassword) {
    String stored = user.getPassword();
    if (stored == null || stored.isBlank()) {
      return false;
    }

    if (isBcryptHash(stored)) {
      return PASSWORD_ENCODER.matches(rawPassword, stored);
    }

    boolean matched = stored.equals(rawPassword);
    if (matched) {
      // Compatible with old plaintext data, and upgrade to bcrypt on successful login.
      String encoded = PASSWORD_ENCODER.encode(rawPassword);
      userMapper.update(
        null,
        new LambdaUpdateWrapper<UserEntity>()
          .eq(UserEntity::getId, user.getId())
          .set(UserEntity::getPassword, encoded)
      );
      user.setPassword(encoded);
    }
    return matched;
  }

  private boolean isBcryptHash(String value) {
    return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
  }
}
