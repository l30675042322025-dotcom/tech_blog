package com.tche.blog.common;

import java.io.IOException;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import jakarta.servlet.http.HttpServletResponse;

@RestControllerAdvice
public class GlobalExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(AsyncRequestNotUsableException.class)
  public void handleAsyncRequestNotUsable(AsyncRequestNotUsableException ex) {
    log.debug("Client disconnected during async request processing");
  }

  @ExceptionHandler(IOException.class)
  public void handleIOException(IOException ex) {
    String message = ex.getMessage();
    if (message != null && (message.contains("Connection reset") || message.contains("Broken pipe"))) {
      log.debug("Client disconnected during I/O operation");
    } else {
      log.warn("I/O error occurred", ex);
    }
  }

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiResponse<Object>> handleBusiness(BusinessException ex, HttpServletResponse response) {
    log.error("Business exception: status={}, message={}", ex.getStatus(), ex.getMessage());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    return ResponseEntity
      .status(ex.getStatus())
      .body(ApiResponse.fail(ex.getMessage(), null));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiResponse<Object>> handleValid(MethodArgumentNotValidException ex, HttpServletResponse response) {
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    String message = ex
      .getBindingResult()
      .getFieldErrors()
      .stream()
      .map(FieldError::getDefaultMessage)
      .collect(Collectors.joining("; "));
    return ResponseEntity
      .status(HttpStatus.BAD_REQUEST)
      .body(ApiResponse.fail(message, null));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Object>> handleOther(Exception ex, HttpServletResponse response) {
    log.error("Unhandled exception occurred", ex);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    String message = ex.getMessage();
    if (message == null || message.isBlank()) {
      message = ex.getClass().getSimpleName();
    }
    return ResponseEntity
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(ApiResponse.fail("server error: " + message, null));
  }
}
