package com.tche.blog.service.impl;

import org.springframework.stereotype.Service;

import com.tche.blog.mapper.OperationLogMapper;
import com.tche.blog.model.OperationLogEntity;
import com.tche.blog.service.OperationLogService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OperationLogServiceImpl implements OperationLogService {
  private final OperationLogMapper operationLogMapper;

  @Override
  public void save(OperationLogEntity operationLog) {
    operationLogMapper.insert(operationLog);
  }
}
