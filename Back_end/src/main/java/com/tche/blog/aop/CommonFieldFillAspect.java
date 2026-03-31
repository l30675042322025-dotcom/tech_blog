package com.tche.blog.aop;

import java.time.LocalDateTime;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;

import com.tche.blog.model.audit.CreateTimeAware;
import com.tche.blog.model.audit.UpdateTimeAware;

@Aspect
@Component
public class CommonFieldFillAspect {
  @Before("execution(* com.tche.blog.mapper..*.insert(..))")
  public void beforeInsert(JoinPoint joinPoint) {
    Object[] args = joinPoint.getArgs();
    if (args == null || args.length == 0 || args[0] == null) {
      return;
    }
    LocalDateTime now = LocalDateTime.now();
    Object entity = args[0];

    if (entity instanceof CreateTimeAware createTimeAware && createTimeAware.getCreatedAt() == null) {
      createTimeAware.setCreatedAt(now);
    }
    if (entity instanceof UpdateTimeAware updateTimeAware && updateTimeAware.getUpdatedAt() == null) {
      updateTimeAware.setUpdatedAt(now);
    }
  }

  @Before("execution(* com.tche.blog.mapper..*.update*(..))")
  public void beforeUpdate(JoinPoint joinPoint) {
    Object[] args = joinPoint.getArgs();
    if (args == null || args.length == 0 || args[0] == null) {
      return;
    }
    Object entity = args[0];
    if (entity instanceof UpdateTimeAware updateTimeAware) {
      updateTimeAware.setUpdatedAt(LocalDateTime.now());
    }
  }
}
