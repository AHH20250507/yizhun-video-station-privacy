/* Immutable, page-lifetime replay snapshots. No credentials or storage. */
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const reference = item => typeof item === 'string' ? item : (item?.reference || item?.url || item?.source || '');
  const mediaKeys = { image: 'images', video: 'videos', audio: 'audios' };
  function capture(request, refMediaList = []) {
    const saved = {};
    for (const key of ['mode', 'operation', 'model', 'prompt', 'input', 'duration', 'count']) {
      if (request[key] !== undefined) saved[key] = clone(request[key]);
    }
    const refs = refMediaList.map(item => {
      const result = {};
      for (const key of ['id', 'tag', 'type', 'reference', 'url', 'mediaId', 'fileName', 'mimeType', 'sizeBytes']) {
        if (item[key] !== undefined) result[key] = clone(item[key]);
      }
      return result;
    });
    return { version: 1, request: saved, refMediaList: refs };
  }
  function validate(snapshot) {
    if (snapshot?.version !== 1 || !snapshot.request) throw new Error('原始请求快照不可用，不能保证原样再次生成');
    const { request, refMediaList = [] } = snapshot;
    if (!request.model || !['image', 'video'].includes(request.operation)) throw new Error('原始模型或任务类型不可用');
    const tags = new Map();
    for (const item of refMediaList) {
      if (tags.has(item.tag)) throw new Error(`参考标签 ${item.tag} 重复，无法确定对应素材`);
      tags.set(item.tag, item);
    }
    for (const tag of String(request.prompt || '').match(/@图\d+/g) || []) {
      if (!tags.get(tag) || !reference(tags.get(tag))) throw new Error(`${tag} 的原始参考素材缺失，不能只发送文字`);
    }
    for (const [type, key] of Object.entries(mediaKeys)) {
      const values = (request.input?.[key] || []).map(reference);
      const typed = refMediaList.filter(item => item.type === type);
      if (values.some(value => !value)) throw new Error('原始参考素材缺失');
      if (typed.length !== values.length || typed.some((item, index) => reference(item) !== values[index])) {
        throw new Error(`${type} 参考素材与原始请求的对应顺序不一致`);
      }
    }
    return true;
  }
  function toRequest(snapshot) {
    validate(snapshot);
    return clone(snapshot.request);
  }
  window.TaskRegeneration = Object.freeze({ capture, validate, toRequest });
})();
