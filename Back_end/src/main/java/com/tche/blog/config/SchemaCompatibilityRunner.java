package com.tche.blog.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class SchemaCompatibilityRunner implements ApplicationRunner {
  private static final Logger LOGGER = LoggerFactory.getLogger(SchemaCompatibilityRunner.class);

  private final JdbcTemplate jdbcTemplate;

  @Override
  public void run(ApplicationArguments args) {
    ensureArticleStatusColumn();
    ensureArticleSummaryAiGeneratedColumn();
    ensureArticleInteractionTables();
    ensureEssayTable();
    ensureEssayLocationColumn();
    ensureEssayUpdatedAtIndex();
    ensureEssayHiddenColumn();
  }

  private void ensureArticleStatusColumn() {
    Integer hasColumn = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(1)
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'articles'
        AND column_name = 'status'
      """,
      Integer.class
    );

    if (hasColumn != null && hasColumn > 0) {
      return;
    }

    LOGGER.warn("Column articles.status is missing. Applying compatibility migration.");
    jdbcTemplate.execute(
      "ALTER TABLE `articles` ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'published' AFTER `category`"
    );
    jdbcTemplate.execute("UPDATE `articles` SET `status` = 'published' WHERE `status` IS NULL OR `status` = ''");

    Integer hasIndex = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(1)
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'articles'
        AND index_name = 'idx_articles_status'
      """,
      Integer.class
    );

    if (hasIndex == null || hasIndex == 0) {
      jdbcTemplate.execute("CREATE INDEX `idx_articles_status` ON `articles` (`status`)");
    }
  }

  private void ensureArticleInteractionTables() {
    jdbcTemplate.execute(
      """
      CREATE TABLE IF NOT EXISTS `article_likes` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `article_id` BIGINT UNSIGNED NOT NULL,
        `user_id` BIGINT UNSIGNED NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_article_likes_article_user` (`article_id`, `user_id`),
        KEY `idx_article_likes_user_id` (`user_id`),
        CONSTRAINT `fk_article_likes_article`
          FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT `fk_article_likes_user`
          FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      """
    );

    jdbcTemplate.execute(
      """
      CREATE TABLE IF NOT EXISTS `article_favorites` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `article_id` BIGINT UNSIGNED NOT NULL,
        `user_id` BIGINT UNSIGNED NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_article_favorites_article_user` (`article_id`, `user_id`),
        KEY `idx_article_favorites_user_id` (`user_id`),
        CONSTRAINT `fk_article_favorites_article`
          FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT `fk_article_favorites_user`
          FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      """
    );
  }

  private void ensureArticleSummaryAiGeneratedColumn() {
    Integer hasColumn = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(1)
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'articles'
        AND column_name = 'summary_ai_generated'
      """,
      Integer.class
    );

    if (hasColumn != null && hasColumn > 0) {
      return;
    }

    LOGGER.warn("Column articles.summary_ai_generated is missing. Applying compatibility migration.");
    jdbcTemplate.execute(
      "ALTER TABLE `articles` ADD COLUMN `summary_ai_generated` TINYINT(1) NOT NULL DEFAULT 0 AFTER `summary`"
    );
    jdbcTemplate.execute(
      "UPDATE `articles` SET `summary_ai_generated` = 0 WHERE `summary_ai_generated` IS NULL"
    );
  }

  private void ensureEssayTable() {
    jdbcTemplate.execute(
      """
      CREATE TABLE IF NOT EXISTS `essays` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `title` VARCHAR(200) NOT NULL,
        `content_path` VARCHAR(255) NOT NULL,
        `author_id` BIGINT UNSIGNED DEFAULT NULL,
        `author_name` VARCHAR(64) NOT NULL,
        `location` VARCHAR(128) DEFAULT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_essays_author_name` (`author_name`),
        KEY `idx_essays_created_at` (`created_at`),
        KEY `idx_essays_updated_at` (`updated_at`),
        KEY `idx_essays_author_id` (`author_id`),
        CONSTRAINT `fk_essays_author`
          FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      """
    );
  }

  private void ensureEssayLocationColumn() {
    Integer hasColumn = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(1)
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'essays'
        AND column_name = 'location'
      """,
      Integer.class
    );

    if (hasColumn != null && hasColumn > 0) {
      return;
    }

    LOGGER.warn("Column essays.location is missing. Applying compatibility migration.");
    jdbcTemplate.execute(
      "ALTER TABLE `essays` ADD COLUMN `location` VARCHAR(128) NULL DEFAULT NULL AFTER `author_name`"
    );
  }

  private void ensureEssayUpdatedAtIndex() {
    Integer hasIndex = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(1)
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'essays'
        AND index_name = 'idx_essays_updated_at'
      """,
      Integer.class
    );

    if (hasIndex != null && hasIndex > 0) {
      return;
    }

    LOGGER.warn("Index essays.idx_essays_updated_at is missing. Applying compatibility migration.");
    jdbcTemplate.execute("CREATE INDEX `idx_essays_updated_at` ON `essays` (`updated_at`)");
  }

  private void ensureEssayHiddenColumn() {
    Integer hasColumn = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(1)
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'essays'
        AND column_name = 'hidden'
      """,
      Integer.class
    );

    if (hasColumn != null && hasColumn > 0) {
      return;
    }

    LOGGER.warn("Column essays.hidden is missing. Applying compatibility migration.");
    jdbcTemplate.execute(
      "ALTER TABLE `essays` ADD COLUMN `hidden` TINYINT(1) NOT NULL DEFAULT 0 AFTER `cover_image`"
    );
    jdbcTemplate.execute("UPDATE `essays` SET `hidden` = 0 WHERE `hidden` IS NULL");
  }
}
