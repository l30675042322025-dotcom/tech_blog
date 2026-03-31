package com.tche.blog.task;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tche.blog.mapper.ArticleMapper;
import com.tche.blog.model.ArticleEntity;
import com.tche.blog.service.ArticleService;

import jakarta.annotation.Resource;

@Component
public class ScheduledArticlePublisher {
  private static final Logger LOGGER = LoggerFactory.getLogger(ScheduledArticlePublisher.class);
  private static final String STATUS_SCHEDULED = "scheduled";

  @Resource
  private ArticleMapper articleMapper;

  @Resource
  private ArticleService articleService;

  @Scheduled(fixedRate = 60000)
  public void publishScheduledArticles() {
    LocalDateTime now = LocalDateTime.now();

    LambdaQueryWrapper<ArticleEntity> queryWrapper = new LambdaQueryWrapper<>();
    queryWrapper
      .eq(ArticleEntity::getStatus, STATUS_SCHEDULED)
      .le(ArticleEntity::getPublishTime, now);

    List<ArticleEntity> articlesToPublish = articleMapper.selectList(queryWrapper);

    if (articlesToPublish.isEmpty()) {
      return;
    }

    LOGGER.info("Found {} scheduled articles to publish at {}", articlesToPublish.size(), now);

    for (ArticleEntity article : articlesToPublish) {
      try {
        articleService.publishScheduledArticle(article.getId());
        LOGGER.info("Successfully published scheduled article: {} (ID: {})", article.getTitle(), article.getId());
      } catch (Exception e) {
        LOGGER.error("Failed to publish scheduled article: {} (ID: {})", article.getId(), article.getTitle(), e);
      }
    }
  }
}
