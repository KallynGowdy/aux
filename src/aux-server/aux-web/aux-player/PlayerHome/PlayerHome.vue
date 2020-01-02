<template>
    <div>
        <game-view
            v-if="!isLoading"
            class="game-view"
            :class="{ 'has-run-bar': hasToolbar }"
            :debug="debug"
            :context="context"
        >
            <div class="ui-container">
                <md-card
                    ref="card"
                    class="info-card"
                    :class="{ maximized: this.setLargeSheet }"
                    v-if="hasToolbar && isOpen && isVis"
                >
                    <md-card-content>
                        <bot-table
                            ref="table"
                            class="bots-table"
                            @closeWindow="toggleOpen()"
                            @tagFocusChanged="tagFocusChanged"
                            :bots="bots"
                            :searchResult="searchResult"
                            :setLargeSheet="setLargeSheet"
                            :isSearch="isSearch"
                            :updateTime="updateTime"
                            :selectionMode="selectionMode"
                            :diffSelected="isDiff"
                            :showAddTagButton="false"
                        ></bot-table>
                    </md-card-content>
                </md-card>
            </div>
        </game-view>
    </div>
</template>
<script src="./PlayerHome.ts"></script>
<style src="./PlayerHome.css"></style>
