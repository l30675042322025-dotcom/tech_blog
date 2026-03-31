package com.tche.blog.aop;

import java.util.Arrays;
import java.util.stream.Collectors;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import com.tche.blog.context.OperatorContextHolder;
import com.tche.blog.context.OperatorInfo;
import com.tche.blog.model.OperationLogEntity;
import com.tche.blog.service.OperationLogService;

import lombok.RequiredArgsConstructor;

@Aspect
@Component
@RequiredArgsConstructor
public class OperationLogAspect {
  private final OperationLogService operationLogService;

  @Around("@annotation(com.tche.blog.aop.TrackOperation)")
  public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
    TrackOperation annotation = signature.getMethod().getAnnotation(TrackOperation.class);

    String target = annotation.target() + " | args=" + compactArgs(joinPoint.getArgs());
    OperationLogEntity log = new OperationLogEntity();
    fillOperator(log);
    log.setOperationName(annotation.name());
    log.setOperationTarget(target);

    try {
      Object result = joinPoint.proceed();
      fillOperator(log);
      log.setSuccess(Boolean.TRUE);
      operationLogService.save(log);
      return result;
    } catch (Throwable throwable) {
      fillOperator(log);
      log.setSuccess(Boolean.FALSE);
      log.setErrorMessage(trimMessage(throwable.getMessage()));
      operationLogService.save(log);
      throw throwable;
    }
  }

  private void fillOperator(OperationLogEntity log) {
    OperatorInfo operator = OperatorContextHolder.get();
    if (operator == null) {
      if (log.getOperatorName() == null) {
        log.setOperatorName("anonymous");
      }
      return;
    }
    log.setOperatorId(operator.userId());
    log.setOperatorName(operator.username());
  }

  private String compactArgs(Object[] args) {
    if (args == null || args.length == 0) {
      return "[]";
    }
    return Arrays
      .stream(args)
      .map(this::safeToString)
      .collect(Collectors.joining(", ", "[", "]"));
  }

  private String safeToString(Object value) {
    if (value == null) {
      return "null";
    }
    String text = maskSensitive(value.toString());
    if (text.length() > 150) {
      return text.substring(0, 150) + "...";
    }
    return text;
  }

  private String trimMessage(String message) {
    if (message == null) {
      return null;
    }
    return message.length() > 500 ? message.substring(0, 500) : message;
  }

  private String maskSensitive(String source) {
    if (source == null || source.isBlank()) {
      return source;
    }
    String text = source;
    text = text.replaceAll("(?i)(password=)([^,\\] }]+)", "$1***");
    text = text.replaceAll("(?i)(emailCode=)([^,\\] }]+)", "$1***");
    text = text.replaceAll("(?i)(captchaCode=)([^,\\] }]+)", "$1***");
    text = text.replaceAll("(?i)(accessKeySecret=)([^,\\] }]+)", "$1***");
    text = text.replaceAll("(?i)(token=)([^,\\] }]+)", "$1***");
    text = text.replaceAll("(?i)(authorization=)([^,\\] }]+)", "$1***");
    text = text.replaceAll("(?i)(\"password\"\\s*:\\s*\")([^\"]+)(\")", "$1***$3");
    text = text.replaceAll("(?i)(\"emailCode\"\\s*:\\s*\")([^\"]+)(\")", "$1***$3");
    text = text.replaceAll("(?i)(\"captchaCode\"\\s*:\\s*\")([^\"]+)(\")", "$1***$3");
    text = text.replaceAll("(?i)(\"accessKeySecret\"\\s*:\\s*\")([^\"]+)(\")", "$1***$3");
    text = text.replaceAll("(?i)(\"token\"\\s*:\\s*\")([^\"]+)(\")", "$1***$3");
    return text;
  }
}
