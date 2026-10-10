// 3D card mesh: bevelled extruded body plus textured face planes. Materials are
// theme-driven and can be re-skinned in place with applyCardStyle().
import * as THREE from 'three';
import { cardFaceTexture, cardBackTexture, paperNormalTexture } from './textures.js';

export const CARD = { W: 0.9, H: 1.26, R: 0.085, D: 0.022 };
const BEVEL = 0.0035;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

let shared = null;

function getShared() {
  if (shared) return shared;
  const shape = roundedRectShape(CARD.W - BEVEL * 2, CARD.H - BEVEL * 2, CARD.R);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: CARD.D - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 8,
  });
  bodyGeo.translate(0, 0, -(CARD.D - BEVEL * 2) / 2);
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.computeVertexNormals();

  const frontGeo = new THREE.PlaneGeometry(CARD.W, CARD.H);
  frontGeo.rotateX(-Math.PI / 2);
  const backGeo = new THREE.PlaneGeometry(CARD.W, CARD.H);
  backGeo.rotateX(Math.PI / 2);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.6, metalness: 0.02 });
  shared = { bodyGeo, frontGeo, backGeo, bodyMat };
  return shared;
}

function styleFace(mat, style, map) {
  mat.map = map;
  mat.normalMap = paperNormalTexture();
  mat.normalScale.set(0.12, 0.12);
  mat.clearcoat = style.clearcoat;
  mat.clearcoatRoughness = 0.45;
  mat.envMapIntensity = 0.55; // keep the HDRI from veiling the ink
  mat.roughness = 0.5;
  if (style.emissive > 0) {
    // Neon faces: the face art drives emission so indices and pips bloom.
    mat.emissiveMap = map;
    mat.emissive.set(0xffffff);
    mat.emissiveIntensity = style.emissive;
  } else {
    mat.emissiveMap = null;
    mat.emissive.set(0x000000);
    mat.emissiveIntensity = 0;
  }
  mat.needsUpdate = true;
}

export function buildCardMesh(id, style) {
  const { bodyGeo, frontGeo, backGeo, bodyMat } = getShared();
  const group = new THREE.Group();
  group.userData.cardId = id;

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const frontMat = new THREE.MeshPhysicalMaterial({ alphaTest: 0.5 });
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.y = CARD.D / 2 + 0.0012;
  front.receiveShadow = true;
  front.userData.cardId = id;
  group.add(front);

  const backMat = new THREE.MeshPhysicalMaterial({ alphaTest: 0.5 });
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.y = -CARD.D / 2 - 0.0012;
  group.add(back);

  group.userData.front = front;
  group.userData.frontMat = frontMat;
  group.userData.backMat = backMat;
  applyCardStyle(group, style);
  return group;
}

// Re-skin a card for the active theme (call after setCardTheme()).
export function applyCardStyle(group, style) {
  const id = group.userData.cardId;
  styleFace(group.userData.frontMat, style, cardFaceTexture(id));
  styleFace(group.userData.backMat, style, cardBackTexture());
  getShared().bodyMat.color.setHex(style.edge);
}
