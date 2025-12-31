import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LobbySnapshot } from '../../../models';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrls: ['../../home.shared.scss', './hero.component.scss'],
})
export class HeroComponent {
  @Input({ required: true }) lobby: LobbySnapshot | null = null;
  @Input({ required: true }) wsStatus = '';
  @Input({ required: true }) errorMessage: string | null = null;
  @Output() leave = new EventEmitter<void>();
}
