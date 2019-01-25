import {
  Scene,
  Renderer,
  Mesh,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  Math as ThreeMath,
  Group,
  MeshBasicMaterial,
  LineBasicMaterial,
  PCFSoftShadowMap,
  BackSide,
  TextureLoader,
  SphereBufferGeometry,
  BoxBufferGeometry,
  GLTFLoader,
  HemisphereLight,
  Side,
  DoubleSide,
  Object3D,
} from 'three';
import 'three-examples/loaders/GLTFLoader';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject } from 'vue-property-decorator';
import {
  SubscriptionLike,
} from 'rxjs';

import { File, Object, Workspace } from 'common/Files';
import { time } from '../game-engine/Time';
import { Input } from '../game-engine/input';
import { File3D } from '../game-engine/File3D';

import { vg } from "von-grid";

import skyTexturePath from '../public/images/CGSkies_0132_free.jpg';
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import groundModelPath from '../public/models/ground.gltf';
import { appManager } from '../AppManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { ArgEvent } from '../../common/Events';
import createBMFont from 'three-bmfont-text';

@Component({
})
export default class GameView extends Vue {

  private _scene: Scene;
  private _camera: PerspectiveCamera;
  private _renderer: Renderer;

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _workspacePlane: Mesh;
  private _skydome: Mesh;
  private _grids: Group;
  private _canvas: HTMLElement;
  private _input: Input;
  private _interaction: InteractionManager;

  public onFileAdded: ArgEvent<File3D> = new ArgEvent<File3D>();
  public onFileUpdated: ArgEvent<File3D> = new ArgEvent<File3D>();
  public onFileRemoved: ArgEvent<File3D> = new ArgEvent<File3D>();

  /**
   * A map of file IDs to files and meshes.
   */
  private _files: {
    [id: string]: File3D
  } = {};

  /**
   * A map of mesh IDs to file IDs.
   */
  private _fileIds: {
    [mesh: number]: string
  } = {};

  private _subs: SubscriptionLike[];

  get gameView(): HTMLElement { return <HTMLElement>this.$refs.gameView; }
  get input(): Input { return this._input; }
  get interactionManager(): InteractionManager { return this._interaction; }
  get camera(): PerspectiveCamera { return this._camera; }
  get grids(): Group { return this._grids; }
  get workspacePlane(): Mesh { return this._workspacePlane; }

  get fileManager() {
    return appManager.fileManager;
  }

  async mounted() {
    time.init();

    this._files = {};
    this._fileIds = {};
    this._subs = [];
    this._setupScene();
    this._input = new Input();
    this._input.init(this.gameView);
    this._interaction = new InteractionManager(this);

    // Subscriptions to file events.
    this._subs.push(this.fileManager.fileDiscovered.subscribe(file => {
      this._fileAdded(file);
    }));
    this._subs.push(this.fileManager.fileRemoved.subscribe(file => {
      this._fileRemoved(file);
    }));
    this._subs.push(this.fileManager.fileUpdated.subscribe(file => {
      this._fileUpdated(file);
    }));

    this._frameUpdate();
  }

  beforeDestroy() {
    this._input.terminate();

    if (this._subs) {
      this._subs.forEach(sub => {
        sub.unsubscribe();
      });
      this._subs = [];
    }
  }

  private _frameUpdate() {
    // console.log("game view update frame: " + time.frameCount);
    this._interaction.update();
    this._renderer.render(this._scene, this._camera);

    requestAnimationFrame(() => this._frameUpdate());
  }

  /**
   * Returns the file id that is represented by the specified mesh id.
   * @param meshId The id of the mesh.
   */
  public getFileId(meshId: number): string {
    return this._fileIds[meshId];
  }

  /**
   * Returns the file that matches the specified file id.
   * @param fileId The id of the file.
   */
  public getFile(fileId: string): File3D {
    return this._files[fileId];
  }

  private _fileUpdated(file: File) {
    const obj = this._files[file.id];
    if (obj) {
      obj.file = file;
      if (file.type === 'object') {
        this._updateFile(obj, file);
      } else {
        this._updateWorkspace(obj, file);
      }

      this.onFileUpdated.invoke(obj);
    } else {
      console.log('cant find file to update it');
    }
  }

  private _updateFile(obj: File3D, data: Object) {
    // visible if not destroyed, has a position, and not hidden
    obj.mesh.visible = (!data.tags._destroyed && !!data.tags._position && !data.tags._hidden);
    const workspace = this._files[data.tags._workspace];
    obj.file = data;
    if (workspace) {
      obj.mesh.parent = workspace.mesh;
    } else {
      obj.mesh.parent = null;
    }

    if (data.tags.color) {
      const mesh = <Mesh>obj.mesh;
      const material = <MeshStandardMaterial>mesh.material;
      material.color = this._getColor(data.tags.color);
    } else {
      const mesh = <Mesh>obj.mesh;
      const material = <MeshStandardMaterial>mesh.material;
      material.color = new Color(0x00FF00);
    }

    if (data.tags._position) {
      obj.mesh.position.set(
        data.tags._position.x + 0,
        data.tags._position.y + 0.095,
        data.tags._position.z + 0);
    } else {
      // Default position
      obj.mesh.position.set(0, 1, 0);
    }
  }

  private _getColor(color: string): Color {
    return new Color(color);
  }

  private _updateWorkspace(obj: File3D, data: Workspace) {
    obj.mesh.position.x = obj.grid.group.position.x = data.position.x || 0;
    obj.mesh.position.y = obj.grid.group.position.y = data.position.y || 0;
    obj.mesh.position.z = obj.grid.group.position.z = data.position.z || 0;

    if (typeof data.size !== 'undefined' && obj.surface.grid.size !== data.size) {
      obj.surface.grid.cells = {};
      obj.surface.grid.numCells = 0;
      obj.surface.grid.generate({
        size: data.size || 0
      });
      obj.generateTilemap(obj.surface, data);
      obj.surface.group.position.y -= .4;
    }

    obj.grid.group.position.y -= .45;
    obj.grid.group.updateMatrixWorld(false);
  }

  private _fileAdded(file: File) {
    console.log("File Added!");

    if (file.type === 'object' && file.tags._hidden) {
      return;
    }
    
    var obj = new File3D(file);

    this._files[file.id] = obj;
    this._fileIds[obj.mesh.id] = obj.file.id;
    
    this._scene.add(obj.mesh);

    if (obj.grid) {
      this._fileIds[obj.grid.group.id] = obj.file.id;
      this._grids.add(obj.grid.group);
    }

    this.onFileAdded.invoke(obj);

    this._fileUpdated(file);
  }

  private _fileRemoved(id: string) {
    const obj = this._files[id];
    if (obj) {
      delete this._fileIds[obj.mesh.id];
      delete this._files[id];
      this._scene.remove(obj.mesh);

      this.onFileRemoved.invoke(obj);
    }
  }

  private _setupScene() {

    this._scene = new Scene();
    this._scene.background = new Color(0xCCE6FF);

    this._setupRenderer();

    // Grid group.
    this._grids = new Group();
    this._grids.visible = false;
    this._scene.add(this._grids);

    // User's camera
    this._camera = new PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 20000);
    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = ThreeMath.degToRad(-30);
    this._camera.updateMatrixWorld(false);

    // Ambient light.
    this._ambient = new AmbientLight(0xffffff, 0.8);
    this._scene.add(this._ambient);

    // Sky light.
    this._skylight = new HemisphereLight(0xc1e0fd, 0xffffff, .6);
    this._scene.add(this._skylight);


    // Sun light.
    this._sun = new DirectionalLight(0xffffff, .6);
    this._sun.position.set(5, 5, 5);
    this._sun.position.multiplyScalar(50);
    this._sun.name = "sun";
    this._sun.castShadow = true;
    this._sun.shadowMapWidth = this._sun.shadowMapHeight = 1024 * 2;

    var d = 30;
    this._sun.shadow.camera.left = -d;
    this._sun.shadow.camera.right = d;
    this._sun.shadow.camera.top = d;
    this._sun.shadow.camera.bottom = -d;
    this._sun.shadow.camera.far = 3500;

    this._scene.add(this._sun);


    // Workspace plane.
    var gltfLoader = new GLTFLoader();
    gltfLoader.load(groundModelPath, gltf => {
      gltf.scene.traverse((child) => {
        if ((<any>child).isMesh) {
          console.log('[GameView] Assigned workspace plane mesh from gltf file.');
          this._workspacePlane = <Mesh>child;
          this._workspacePlane.castShadow = true;
          this._workspacePlane.receiveShadow = true;
          this._workspacePlane.position.x = 0;
          this._workspacePlane.position.y = 0;
          this._workspacePlane.position.x = 0;
          this._workspacePlane.rotation.x = ThreeMath.DEG2RAD * -90;
          this._workspacePlane.updateMatrixWorld(false);

          // Scale up the workspace plane.
          this._workspacePlane.scale.multiplyScalar(18000);

          this._scene.add(this._workspacePlane);
          return;
        }
      });
    });

    // Skydome
    const skydomeGeometry = new SphereBufferGeometry(9000, 64, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const skydomeTexture = new TextureLoader().load(skyTexturePath);
    const skydomeMaterial = new MeshBasicMaterial({
      side: BackSide,
      map: skydomeTexture,
    });

    this._skydome = new Mesh(skydomeGeometry, skydomeMaterial);
    this._skydome.castShadow = false;
    this._skydome.receiveShadow = false;
    this._skydome.position.set(0, 0, 0);

    // Test bitmap text.
    var textTexture = new TextureLoader().load(robotoTexturePath);
    var textGeometry = createBMFont({ font: robotoFont, text: "hello there! how are you doing friend?", flipY: true, align: "center", width: 200 });
    var textMaterial = new MeshBasicMaterial({
      map: textTexture,
      lights: false,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      color: new Color(0, 0, 0),
    });

    var textMesh = new Mesh(textGeometry, textMaterial);
    var textAnchor = new Object3D();
    textAnchor.add(textMesh);
    textAnchor.scale.multiplyScalar(0.004);
    // rotate the text mesh so that it is upright when rendered.
    textMesh.rotateX(ThreeMath.degToRad(180));
    this._scene.add(textAnchor);
    console.log("added text to scene:")
    console.log(textGeometry);

    this._scene.add(this._skydome);
  }

  private _setupRenderer() {
    const webGlRenderer = this._renderer = new WebGLRenderer({
      antialias: true,
    });
    webGlRenderer.shadowMap.enabled = true;
    webGlRenderer.shadowMap.type = PCFSoftShadowMap;

    // TODO: Call each time the screen size changes
    const container: HTMLElement = <HTMLElement>this.$refs.container;
    const width = window.innerWidth;
    const height = window.innerHeight - container.getBoundingClientRect().top;
    this._renderer.setSize(width, height);
    container.style.height = this._renderer.domElement.style.height;

    this._canvas = this._renderer.domElement;
    this.gameView.appendChild(this._canvas);
  }
};