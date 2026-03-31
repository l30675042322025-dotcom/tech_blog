package com.tche.blog.service.impl;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tche.blog.common.BusinessException;
import com.tche.blog.config.AiSummaryProperties;
import com.tche.blog.service.AiSummaryService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AiSummaryServiceImpl implements AiSummaryService {
  private static final int SUMMARY_MAX_LENGTH = 200;

  private final AiSummaryProperties properties;
  private final ObjectMapper objectMapper;

  @Override
  public String generateSummary(String title, String content) {
    if (!properties.isEnabled()) {
      return "";
    }

    String apiKey = normalize(properties.getApiKey());
    if (apiKey.isBlank()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 摘要未配置 API Key，请先在 application.yml 中补全 ai.summary.api-key");
    }

    String endpoint = resolveEndpoint(properties.getBaseUrl());
    String model = normalize(properties.getModel());
    if (model.isBlank()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 摘要模型未配置，请先设置 ai.summary.model");
    }

    String titleText = normalize(title);
    String contentText = normalizeContent(content, properties.getMaxInputChars());
    if (titleText.isBlank() && contentText.isBlank()) {
      return "";
    }

    String prompt = buildPrompt(titleText, contentText);
    String body = buildRequestBody(model, prompt);
    String responseBody = requestSummary(endpoint, apiKey, body);
    String summary = parseSummary(responseBody);
    if (summary.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI 摘要生成失败，请稍后重试或手动填写摘要");
    }
    return summary;
  }

  private String requestSummary(String endpoint, String apiKey, String body) {
    int connectTimeout = Math.max(1, properties.getConnectTimeoutSeconds());
    int readTimeout = Math.max(1, properties.getReadTimeoutSeconds());

    HttpClient client = HttpClient
      .newBuilder()
      .connectTimeout(Duration.ofSeconds(connectTimeout))
      .build();

    HttpRequest request = HttpRequest
      .newBuilder(URI.create(endpoint))
      .timeout(Duration.ofSeconds(readTimeout))
      .header("Content-Type", "application/json")
      .header("Authorization", "Bearer " + apiKey)
      .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
      .build();

    try {
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() >= 400) {
        throw new BusinessException(
          HttpStatus.BAD_GATEWAY,
          "AI 摘要生成失败，模型接口返回错误（HTTP " + response.statusCode() + "）"
        );
      }
      return response.body();
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI 摘要生成失败，请检查模型地址/API Key 或稍后重试");
    }
  }

  private String buildRequestBody(String model, String prompt) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("model", model);
    payload.put("temperature", 0.2);
    payload.put("stream", false);
    payload.put(
      "messages",
      List.of(
        Map.of(
          "role",
          "system",
          "content",
          "你是中文技术博客编辑。请严格根据输入内容生成简洁摘要，不得编造信息。"
        ),
        Map.of("role", "user", "content", prompt)
      )
    );

    try {
      return objectMapper.writeValueAsString(payload);
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 摘要请求构造失败");
    }
  }

  private String parseSummary(String responseBody) {
    try {
      JsonNode root = objectMapper.readTree(responseBody);
      JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
      String content = extractContent(contentNode);
      return normalizeSummary(content);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI 摘要生成失败，模型响应格式无法解析");
    }
  }

  private String extractContent(JsonNode node) {
    if (node == null || node.isMissingNode() || node.isNull()) {
      return "";
    }
    if (node.isTextual()) {
      return node.asText("");
    }
    if (node.isArray()) {
      StringBuilder text = new StringBuilder();
      for (JsonNode item : node) {
        if (item == null || item.isNull()) {
          continue;
        }
        if (item.isTextual()) {
          text.append(item.asText(""));
          continue;
        }
        String part = item.path("text").asText("");
        if (!part.isBlank()) {
          text.append(part);
        }
      }
      return text.toString();
    }
    return node.asText("");
  }

  private String normalizeSummary(String summary) {
    String text = normalize(summary);
    if (text.startsWith("摘要：")) {
      text = text.substring("摘要：".length()).trim();
    } else if (text.startsWith("摘要:")) {
      text = text.substring("摘要:".length()).trim();
    }
    if (text.length() > SUMMARY_MAX_LENGTH) {
      text = text.substring(0, SUMMARY_MAX_LENGTH).trim();
    }
    return text;
  }

  private String normalizeContent(String value, int maxChars) {
    String text = normalize(value)
      .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
      .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
      .replaceAll("(?is)<[^>]+>", " ");
    text = text
      .replace("&nbsp;", " ")
      .replace("&lt;", "<")
      .replace("&gt;", ">")
      .replace("&amp;", "&")
      .replace("&quot;", "\"")
      .replace("&#39;", "'");
    text = normalize(text);

    int limit = Math.max(1000, maxChars);
    if (text.length() > limit) {
      return text.substring(0, limit);
    }
    return text;
  }

  private String buildPrompt(String title, String content) {
    return """
      请为以下文章生成一段中文摘要，要求：
      1. 40-120字；
      2. 客观准确，不添加原文没有的信息；
      3. 不要使用“本文介绍了”等套话；
      4. 只返回摘要正文，不要序号、引号和 Markdown。

      标题：
      %s

      正文：
      %s
      """.formatted(title, content);
  }

  private String resolveEndpoint(String baseUrl) {
    String base = normalize(baseUrl);
    if (base.isBlank()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 摘要服务地址未配置，请先设置 ai.summary.base-url");
    }
    if (base.endsWith("/chat/completions")) {
      return base;
    }
    if (base.endsWith("/")) {
      return base + "chat/completions";
    }
    return base + "/chat/completions";
  }

  private String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.trim().replaceAll("\\s+", " ");
  }
}
