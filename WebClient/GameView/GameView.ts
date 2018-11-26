import { 
  Scene,
  Camera, 
  Renderer, 
  Clock, 
  Mesh, 
  Light,
  Color,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  BoxGeometry,
  MeshStandardMaterial,
  Vector3
} from 'three';
import Vue, {ComponentOptions} from 'vue';
import Component from 'vue-class-component';
import { SubscriptionLike } from 'rxjs';

import {appManager} from '../AppManager';

@Component
export default class GameView extends Vue {
  private _scene: Scene;
  private _camera: Camera;
  private _renderer: Renderer;
  private _clock: Clock;

  private _sun: Light;
  private _ambient: Light;

  private _cube: Mesh;

  private _frames: number;

  private _sub: SubscriptionLike;

  async mounted() {
    this._scene = new Scene();
    this._scene.background = new Color(0xffffff);
    this._camera = new PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 1000);

    this._renderer = new WebGLRenderer({
      antialias: true
    });
        
    // TODO: Call each time the screen size changes
    const container: HTMLElement = <HTMLElement>this.$refs.container;
    this._renderer.setSize(window.innerWidth, window.innerHeight - container.getBoundingClientRect().top);
    container.style.height = this._renderer.domElement.style.height;

    this._clock = new Clock();

    const gameView: HTMLElement = <HTMLElement>this.$refs.gameView;
    gameView.appendChild(this._renderer.domElement);

    this._setupScene();

    this._clock.start();
    this._frames = 0;
    this._renderGame();

    this._sub = appManager.events.subscribe(event => {
      console.log("New File!");
    });
  }

  beforeDestroy() {
    if(this._sub) {
      this._sub.unsubscribe();
      this._sub = null;
    }
  }

  private _setupScene() {
    this._ambient = new AmbientLight(0xffffff, 0.1);
    this._scene.add(this._ambient);

    this._sun = new DirectionalLight(0xffffff, 0.7);
    this._sun.position.set(1, 1, 1.5);
    this._sun.castShadow = true;
    this._scene.add(this._sun);

    this._camera.position.z = 5;
    this._camera.updateMatrixWorld(false);

    var geometry = new BoxGeometry(.5, .5, .5);
    var material = new MeshStandardMaterial(
        {color: 0x00ff00, metalness: 0, roughness: 0.6});
    this._cube = new Mesh(geometry, material);
    this._cube.rotation.x = 2;
    this._cube.rotation.y = 0;
    this._cube.rotation.z = 2;
    this._scene.add(this._cube);
  }

  private _renderGame() {
    this._frames += 1;
    requestAnimationFrame(() => this._renderGame());

    const deltaTime = this._clock.getDelta();

    this._updateGame(deltaTime);

    this._renderer.render(this._scene, this._camera);
  }

  private _updateGame(deltaTime: number) {
    // this._animateCube(deltaTime);
  }

  private _fps(): number {
    const seconds = this._clock.getElapsedTime();
    return this._frames / seconds;
  }
};