import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    File,
    AuxFile,
    FileCalculationContext,
    getFileInputTarget,
    calculateFormattedFileValue,
    calculateFileValue,
    isFormula,
    getFileInputPlaceholder,
} from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { MenuItem } from '../MenuContext';

@Component({
    components: {},
})
export default class MenuFile extends Vue {
    @Prop() item: MenuItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    placeholder: string = '';
    input: string = '';
    inputValue: string = '';
    inputTarget: AuxFile = null;
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';
    showDialog: boolean = false;

    @Watch('item')
    private async _fileChanged(item: MenuItem) {
        if (item) {
            // TODO: Fix
            // const calc = item.simulation.simulation.helper.createContext();
            // this._updateLabel(calc, item.file);
            // this._updateColor(calc, item.file);
            // this._updateInput(calc, item.file);
        } else {
            this.label = '';
            this.labelColor = '#000';
            this.backgroundColor = '#FFF';
        }
    }

    constructor() {
        super();
    }

    mounted() {
        this._fileChanged(this.item);
    }

    async click() {
        await this.item.simulation.simulation.action('onClick', [
            this.item.file,
        ]);
        if (this.input) {
            // TODO: Fix
            // const calc = this.item.simulation.simulation.helper.createContext();
            // this._updateInput(calc, this.item.file);
            this.showDialog = true;
        }
    }

    async closeDialog() {
        if (this.showDialog) {
            await this.item.simulation.simulation.action('onClose', [
                this.item.file,
            ]);
            this.showDialog = false;
        }
    }

    async saveDialog() {
        if (this.showDialog) {
            await this.item.simulation.simulation.updateFile(this.inputTarget, {
                tags: {
                    [this.input]: this.inputValue,
                },
            });
            await this.item.simulation.simulation.action('onSave', [
                this.item.file,
            ]);
            await this.closeDialog();
        }
    }

    private _updateColor(calc: FileCalculationContext, file: AuxFile) {
        if (file.tags['aux.color']) {
            this.backgroundColor = calculateFileValue(calc, file, 'aux.color');
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: FileCalculationContext, file: AuxFile) {
        let label = file.tags['aux.label'];
        if (label) {
            this.label = calculateFormattedFileValue(calc, file, 'aux.label');
            const labelColor = file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = calculateFormattedFileValue(
                    calc,
                    file,
                    'aux.label.color'
                );
            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }

    private _updateInput(calc: FileCalculationContext, file: AuxFile) {
        let input = file.tags['aux.input'];
        if (input) {
            this.input = calculateFormattedFileValue(calc, file, 'aux.input');

            if (this.input) {
                this.inputTarget = getFileInputTarget(calc, file);
                this.inputValue = calculateFormattedFileValue(
                    calc,
                    this.inputTarget,
                    this.input
                );
                this.placeholder =
                    getFileInputPlaceholder(calc, file) || this.input;
            }
        } else {
            this.input = '';
        }
    }
}
