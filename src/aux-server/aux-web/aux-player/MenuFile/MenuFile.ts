import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    File,
    AuxFile,
    AsyncCalculationContext,
    getFileInputTarget,
    calculateFormattedFileValue,
    calculateFileValue,
    isFormula,
    getFileInputPlaceholder,
} from '@casual-simulation/aux-common';
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
            const calc = item.simulation.simulation;
            await this._updateLabel(calc, item.file);
            await this._updateColor(calc, item.file);
            await this._updateInput(calc, item.file);
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
            const calc = this.item.simulation.simulation;
            this._updateInput(calc, this.item.file);
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

    private async _updateColor(calc: AsyncCalculationContext, file: AuxFile) {
        if (file.tags['aux.color']) {
            this.backgroundColor = await calc.calculateFileValue(
                file,
                'aux.color'
            );
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private async _updateLabel(calc: AsyncCalculationContext, file: AuxFile) {
        let label = file.tags['aux.label'];
        if (label) {
            this.label = await calc.calculateFormattedFileValue(
                file,
                'aux.label'
            );
            const labelColor = file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = await calc.calculateFormattedFileValue(
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

    private async _updateInput(calc: AsyncCalculationContext, file: AuxFile) {
        let input = file.tags['aux.input'];
        if (input) {
            this.input = await calc.calculateFormattedFileValue(
                file,
                'aux.input'
            );

            if (this.input) {
                this.inputTarget = await calc.getFileInputTarget(file);
                this.inputValue = await calc.calculateFormattedFileValue(
                    this.inputTarget,
                    this.input
                );
                this.placeholder =
                    (await calc.getFileInputPlaceholder(file)) || this.input;
            }
        } else {
            this.input = '';
        }
    }
}
