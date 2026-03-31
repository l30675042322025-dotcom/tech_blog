/**
 * 玩偶眼睛跟随鼠标效果和交互
 * 让左侧装饰区域的玩偶眼睛能够跟随鼠标移动
 * 并在用户输入时产生交互反应
 */

(function () {
  'use strict';

  const puppetsContainer = document.querySelector('.puppets-container');
  const puppets = document.querySelectorAll('.puppet');
  const inputs = document.querySelectorAll('.auth-form input');
  
  let isTyping = false;
  let typingTimeout = null;

  if (puppets.length === 0 || !puppetsContainer) return;

  // 获取所有瞳孔元素
  function getAllPupils() {
    const pupils = [];
    puppets.forEach(puppet => {
      const puppetPupils = puppet.querySelectorAll('.eye-pupil');
      puppetPupils.forEach(pupil => {
        pupils.push({
          pupil,
          eye: pupil.parentElement,
          puppet
        });
      });
    });
    return pupils;
  }

  // 计算瞳孔应该移动到的位置
  function calculatePupilPosition(pupil, eye) {
    const eyeRect = eye.getBoundingClientRect();
    
    const eyeCenterX = eyeRect.left + eyeRect.width / 2;
    const eyeCenterY = eyeRect.top + eyeRect.height / 2;
    
    // 获取鼠标位置
    const mouseX = window.mouseX || window.innerWidth / 2;
    const mouseY = window.mouseY || window.innerHeight / 2;
    
    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    
    // 根据眼睛类型设置最大移动距离和灵敏度
    const isEyeBall = eye.classList.contains('eye-large');
    const maxDistance = isEyeBall ? 12 : 9;  // 进一步增大最大移动距离
    const sensitivity = isEyeBall ? 25 : 18; // 进一步增大灵敏度
    
    // 计算移动距离
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);
    
    // 打字时瞳孔向左看
    let moveDistance = Math.min(distance / sensitivity, maxDistance);
    let moveX = Math.cos(angle) * moveDistance;
    let moveY = Math.sin(angle) * moveDistance;
    
    if (isTyping) {
      // 打字时向左看
      moveX = -maxDistance * 0.8;
      moveY = -2;
    }
    
    return { x: moveX, y: moveY };
  }

  // 更新所有瞳孔位置
  function updatePupils() {
    const pupils = getAllPupils();
    
  puppets.forEach(puppet => {
    const puppetType = puppet.dataset.puppet;
    const body = puppet.querySelector('.puppet-body');
    
    // 获取鼠标相对于玩偶中心的位置
    const mouseX = window.mouseX || window.innerWidth / 2;
    const mouseXNormalized = (mouseX - window.innerWidth * 0.225) / 20; // 调整偏移量适应新布局
    
    if (body) {
      // 计算身体的倾斜
      const skewAmount = Math.max(-6, Math.min(6, -mouseXNormalized * 0.3));
      
      if (isTyping) {
        // 打字时的特殊效果
        if (puppetType === 'purple') {
          // 身体前倾，眼睛区域独立出来
          body.style.transform = 'skewX(10deg) translateY(-5px)';
          body.style.height = '400px';
          // 眼睛独立于身体
          const eyes = puppet.querySelector('.puppet-eyes');
          if (eyes) {
            eyes.style.transform = 'translateY(-30px)';
            eyes.style.zIndex = '25';
          }
        } else if (puppetType === 'grey') {
          body.style.transform = 'skewX(10deg) translateX(20px)';
        } else if (puppetType === 'orange') {
          body.style.transform = 'skewX(0deg)';
        } else if (puppetType === 'yellow') {
          body.style.transform = 'skewX(0deg)';
        }
      } else {
        // 正常状态
        body.style.transform = `skewX(${skewAmount}deg)`;
        body.style.height = '';
        // 重置眼睛位置
        const eyes = puppet.querySelector('.puppet-eyes');
        if (eyes) {
          eyes.style.transform = '';
          eyes.style.zIndex = '';
        }
      }
    }
    
    // 更新眼睛位置
    const eyes = puppet.querySelector('.puppet-eyes');
    if (eyes) {
      eyes.style.zIndex = isTyping ? '20' : '';
    }
  });
    
    // 更新瞳孔位置
    pupils.forEach(({ pupil, eye }) => {
      const pos = calculatePupilPosition(pupil, eye);
      pupil.style.transform = `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`;
    });
  }

  // 鼠标移动事件处理
  const handleMouseMove = (event) => {
    window.mouseX = event.clientX;
    window.mouseY = event.clientY;
    updatePupils();
  };

  // 检测用户输入
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      isTyping = true;
      clearTimeout(typingTimeout);
      updatePupils();
    });
    
    input.addEventListener('blur', () => {
      typingTimeout = setTimeout(() => {
        isTyping = false;
        updatePupils();
      }, 500);
    });
  });

  // 眨眼效果
  function addBlinkEffect() {
    puppets.forEach(puppet => {
      const eyes = puppet.querySelectorAll('.eye-large');
      if (eyes.length === 0) return;
      
      const blink = () => {
        eyes.forEach(eye => {
          eye.style.height = '2px';
          eye.style.transition = 'height 0.1s ease';
        });
        
        setTimeout(() => {
          eyes.forEach(eye => {
            eye.style.height = '';
          });
        }, 150);
      };
      
      // 随机眨眼间隔
      const scheduleBlink = () => {
        const interval = 3000 + Math.random() * 4000;
        setTimeout(() => {
          blink();
          scheduleBlink();
        }, interval);
      };
      
      scheduleBlink();
    });
  }

  // 初始化
  function init() {
    document.addEventListener('mousemove', handleMouseMove);
    addBlinkEffect();
    
    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      document.removeEventListener('mousemove', handleMouseMove);
    });
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
