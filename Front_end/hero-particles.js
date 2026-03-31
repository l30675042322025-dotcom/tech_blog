/**
 * Hero 区域粒子动画
 * 基于 AUROS 网站风格设计
 */

class HeroParticles {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationId = null;
    
    // 配置选项
    this.options = {
      particleCount: options.particleCount || 60,
      particleColor: options.particleColor || '#3b82f6',
      secondaryColor: options.secondaryColor || '#2ed89a',
      connectColor: options.connectColor || 'rgba(59, 130, 246, 0.15)',
      particleSize: options.particleSize || { min: 1, max: 3 },
      speed: options.speed || { x: 0.3, y: 0.2 },
      connectDistance: options.connectDistance || 120,
      mouseDistance: options.mouseDistance || 150,
      ...options
    };
    
    this.mouse = { x: null, y: null };
    this.isRunning = false;
    
    this.init();
  }
  
  init() {
    this.resize();
    this.createParticles();
    this.bindEvents();
    this.animate();
    this.isRunning = true;
  }
  
  resize() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = container.offsetWidth * dpr;
    this.canvas.height = container.offsetHeight * dpr;
    this.canvas.style.width = container.offsetWidth + 'px';
    this.canvas.style.height = container.offsetHeight + 'px';
    
    this.ctx.scale(dpr, dpr);
    this.width = container.offsetWidth;
    this.height = container.offsetHeight;
  }
  
  createParticles() {
    this.particles = [];
    const count = Math.min(this.options.particleCount, Math.floor((this.width * this.height) / 15000));
    
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * this.options.speed.x * 2,
        vy: (Math.random() - 0.5) * this.options.speed.y * 2,
        size: this.randomRange(this.options.particleSize.min, this.options.particleSize.max),
        color: Math.random() > 0.6 ? this.options.secondaryColor : this.options.particleColor,
        alpha: Math.random() * 0.5 + 0.3,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.01
      });
    }
  }
  
  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }
  
  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.createParticles();
    });
    
    // 鼠标交互
    const container = this.canvas.parentElement;
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    
    container.addEventListener('mouseleave', () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });
  }
  
  updateParticle(particle) {
    // 更新位置
    particle.x += particle.vx;
    particle.y += particle.vy;
    
    // 更新脉动
    particle.pulse += particle.pulseSpeed;
    const pulseFactor = Math.sin(particle.pulse) * 0.3 + 0.7;
    
    // 边界检测 - 环绕屏幕
    if (particle.x < 0) particle.x = this.width;
    if (particle.x > this.width) particle.x = 0;
    if (particle.y < 0) particle.y = this.height;
    if (particle.y > this.height) particle.y = 0;
    
    // 鼠标排斥
    if (this.mouse.x !== null && this.mouse.y !== null) {
      const dx = particle.x - this.mouse.x;
      const dy = particle.y - this.mouse.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.options.mouseDistance) {
        const force = (this.options.mouseDistance - distance) / this.options.mouseDistance;
        const angle = Math.atan2(dy, dx);
        particle.x += Math.cos(angle) * force * 2;
        particle.y += Math.sin(angle) * force * 2;
      }
    }
    
    return pulseFactor;
  }
  
  drawParticle(particle, pulseFactor) {
    const { ctx } = this;
    const size = particle.size * pulseFactor;
    
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.alpha * pulseFactor;
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // 发光效果
    if (size > 1.5) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size * 2, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size * 2
      );
      gradient.addColorStop(0, particle.color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.globalAlpha = particle.alpha * pulseFactor * 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  
  drawConnections() {
    const { ctx } = this;
    
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.options.connectDistance) {
          const opacity = (1 - distance / this.options.connectDistance) * 0.5;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = this.options.connectColor;
          ctx.globalAlpha = opacity;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  
  animate() {
    const { ctx } = this;
    
    // 清除画布
    ctx.clearRect(0, 0, this.width, this.height);
    
    // 绘制连接线
    this.drawConnections();
    
    // 更新和绘制粒子
    this.particles.forEach(particle => {
      const pulseFactor = this.updateParticle(particle);
      this.drawParticle(particle, pulseFactor);
    });
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  // 暂停动画
  pause() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      this.isRunning = false;
    }
  }
  
  // 恢复动画
  resume() {
    if (!this.isRunning) {
      this.animate();
      this.isRunning = true;
    }
  }
  
  // 销毁
  destroy() {
    this.pause();
    window.removeEventListener('resize', this.resize);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 延迟初始化，等待 Hero 区域渲染完成
  setTimeout(() => {
    new HeroParticles('hero-particles', {
      particleCount: 100,
      particleColor: 'rgba(59, 130, 246, 0.7)',
      secondaryColor: 'rgba(46, 216, 154, 0.6)',
      connectColor: 'rgba(59, 130, 246, 0.12)',
      particleSize: { min: 1.5, max: 4 },
      speed: { x: 0.5, y: 0.4 },
      connectDistance: 160,
      mouseDistance: 150
    });
  }, 100);
});

// 导出类供其他模块使用
export { HeroParticles };
